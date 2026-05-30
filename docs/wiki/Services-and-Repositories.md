# Services and Repositories

Services and repositories are explicit injectable resources. They are registered
in `createApp(...)`, resolved as singletons during startup, and validated
against BOX dependency boundaries before the first request is served.

## Repository

Repositories own persistence and query concerns. Decorate them with
`@Box.Repository()` so the DI container can validate and instantiate them.

```ts
class User extends Box.Entity<string> {
  public constructor(id: string, public readonly name: string) {
    super(id);
  }
}

@Box.Repository()
class UsersRepository extends Box.Repository<User> {
  public constructor() {
    super(User);
  }

  public findById(id: string): User | undefined {
    return id === "u1" ? new User("u1", "Ada") : undefined;
  }
}
```

## Service

Services own application rules and orchestrate repositories. Declare constructor
dependencies with `deps` on the decorator.

```ts
@Box.Service({ deps: [UsersRepository] })
class UsersService {
  public constructor(private readonly users: UsersRepository) {}

  public findById(id: string): User {
    const user = this.users.findById(id);

    if (!user) {
      throw new Box.HttpError(
        Box.HttpStatus.NOT_FOUND,
        "User not found",
        "user_not_found",
        { id },
      );
    }

    return user;
  }
}
```

## Controller integration

Controllers should depend on services, not repositories. This keeps HTTP code
thin and application rules reusable outside HTTP.

```ts
@Box.Controller("/users", { deps: [UsersService] })
class UsersController {
  public constructor(private readonly users: UsersService) {}

  @Box.Get(":id")
  public findById(input: Param<{ id: string }>): User {
    return this.users.findById(input.params.id);
  }
}

const app = Box.createApp({
  controllers: [UsersController],
  repositories: [UsersRepository],
  services: [UsersService],
});
```

## Custom providers

Use providers for configuration, clocks, clients, and other infrastructure
tokens that are not BOX resources.

```ts
class Config {
  public constructor(public readonly environment: string) {}
}

const app = Box.createApp({
  controllers: [UsersController],
  repositories: [UsersRepository],
  services: [UsersService],
  providers: [
    { provide: Config, useValue: new Config("production") },
  ],
});
```

Providers support `useValue`, `useClass`, and `useFactory` with explicit `deps`.

## Repository with Deno KV

For real persistence, use `Box.KvRepository` directly or extend it with domain
methods.

```ts
class KvDatabase {
  public constructor(public readonly kv: Deno.Kv) {}
}

@Box.Repository({ deps: [KvDatabase] })
class UsersRepository extends Box.KvRepository<User> {
  public constructor(database: KvDatabase) {
    super(User, database.kv, { collection: "users" });
  }

  public async findActiveAdults(): Promise<User[]> {
    return await this.query()
      .where("active", "eq", true)
      .where("age", "gte", 18)
      .orderBy("age", "desc")
      .all();
  }
}
```

## Dependency boundaries

`createApp(...)` validates the resource graph before serving requests:

- controllers may inject services only;
- services may inject services, repositories, or producers only;
- producers may inject services only;
- consumers may inject services only;
- auth strategies may inject services or other auth strategies only;
- repositories may inject repositories or explicit provider tokens for
  infrastructure/configuration concerns.

Invalid graphs fail during startup with a message explaining the violated rule.

## Circular dependencies

Circular dependencies also fail during startup and include the detected chain.
For services, a cycle usually means responsibilities from different contexts are
being mixed into the same service. Prefer splitting orchestration into a
separate service or moving behavior to the proper bounded context.

```text
Circular dependency detected: UsersService -> OrdersService -> UsersService
```

## Testability

Because dependencies are explicit, unit tests can instantiate services directly
with fakes, and integration tests can exercise the real `createApp(...)` graph
with in-memory repositories or providers.
