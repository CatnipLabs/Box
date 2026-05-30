# Architecture and DDD

BOX guides development toward a layered architecture, inspired by DDD and Clean
Architecture, while keeping the core lightweight for serverless.

## Expected layers

```text
presentation/  -> HTTP, controllers, responses, errors, and middlewares
application/   -> services and use cases
domain/        -> entities, domain rules, and base contracts
infra/         -> persistence, runtime, logger, and concrete adapters
```

## Recommended flow

```text
Controller -> Service -> Repository -> Entity
```

- Controller handles HTTP routing and receives validated input objects.
- Service centralizes application/domain rules.
- Repository persists and queries entities.
- Entity represents the domain.

## Base classes and decorators

### Entity

Every domain entity must extend `Box.Entity`.

```ts
class User extends Box.Entity<string> {
  public constructor(id: string, public readonly name: string) {
    super(id);
  }
}
```

### Repository

Repositories are decorated with `@Box.Repository()` and can still extend
`Box.Repository<TEntity>` when they need the base entity validation behavior.

```ts
@Box.Repository()
class UsersRepository extends Box.Repository<User> {
  public constructor() {
    super(User);
  }
}
```

### Service

Services are decorated with `@Box.Service()` and declare constructor
dependencies explicitly.

```ts
@Box.Service({ deps: [UsersRepository] })
class UsersService {
  public constructor(private readonly users: UsersRepository) {}
}
```

### Controller

Controllers use decorators to bind HTTP methods to class methods. By default,
`UsersController` can be mounted at `/users` by convention, but explicit
prefixes are recommended when they improve readability.

```ts
@Box.Controller("/users", { deps: [UsersService] })
class UsersController {
  public constructor(private readonly users: UsersService) {}

  @Box.Get(":id", { request: { params: UserIdParams } })
  public findById(input: Param<UserIdParams>) {
    return this.users.getById(input.params.id);
  }
}
```

## Why explicit `createApp` configuration?

BOX avoids filesystem auto-discovery, runtime reflection, and request-scoped
dependency resolution in the critical path because those features increase
serverless startup cost and reduce predictability.

The preferred pattern is:

```ts
const app = Box.createApp({
  controllers: [UsersController],
  services: [UsersService],
  repositories: [UsersRepository],
  providers: [{ provide: Config, useValue: config }],
});
```

This style keeps dependencies visible, makes tests easier, resolves singletons
once at startup, and preserves low cold starts.
