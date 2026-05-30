# Architecture and DDD

BOX guides development toward a layered architecture inspired by DDD and Clean
Architecture, while keeping startup and the request hot path lightweight for
serverless runtimes.

## Expected layers

```text
presentation/  -> HTTP, controllers, auth decorators, responses, errors, and middlewares
application/   -> services and use cases
domain/        -> entities, domain rules, and repository bases
infra/         -> persistence, runtime adapters, logger, and concrete integrations
```

## Recommended request flow

```text
Request
  -> Middleware
  -> Router
  -> Auth Strategy (optional, before validation)
  -> Zod validation
  -> Controller
  -> Service
  -> Repository
  -> Entity
  -> Response
```

- Controller handles HTTP routing and receives validated input objects.
- Auth Strategy validates credentials using the full request context when a
  route is protected.
- Service centralizes application/domain rules.
- Repository persists and queries entities.
- Entity represents the domain.

## Injectable resources

BOX recognizes four first-class resource kinds:

| Resource      | Decorator                | Responsibility                                |
| ------------- | ------------------------ | --------------------------------------------- |
| Controller    | `@Box.Controller(...)`   | HTTP route grouping and transport mapping     |
| Service       | `@Box.Service(...)`      | Application rules and orchestration           |
| Repository    | `@Box.Repository(...)`   | Persistence/query implementation              |
| Auth Strategy | `@Box.AuthStrategy(...)` | Request authentication/authorization decision |

All dependencies are explicit through decorator options such as
`{ deps: [UsersService] }`. Static `inject`/`dependencies` remain supported for
compatibility, but decorator options are the recommended DX.

## Base classes and decorators

### Entity

Every domain entity used with the base repository must extend `Box.Entity`.

```ts
class User extends Box.Entity<string> {
  public constructor(id: string, public readonly name: string) {
    super(id);
  }
}
```

### Repository

Repositories are decorated with `@Box.Repository()` and can extend
`Box.Repository<TEntity>` for base entity validation or `Box.KvRepository` for
Deno KV persistence.

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

### Auth Strategy

Auth strategies are decorated with `@Box.AuthStrategy()` and receive the full
request `Context` when a protected route runs.

```ts
@Box.AuthStrategy({ name: "jwt", deps: [TokenService] })
class JwtAuthStrategy implements AuthStrategyContract {
  public constructor(private readonly tokens: TokenService) {}

  public validate(ctx: Context): boolean {
    return this.tokens.isValid(ctx.request.headers.get("authorization"));
  }
}
```

### Controller

Controllers use decorators to bind HTTP methods to class methods. Explicit
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

## Dependency boundaries

`createApp(...)` validates the resource graph before registering routes:

- controllers may inject services only;
- services may inject services or repositories only;
- auth strategies may inject services or other auth strategies only;
- repositories may inject repositories or explicit provider tokens only.

This keeps HTTP, auth, application rules, and persistence from bleeding into one
another.

## Circular dependencies

Circular dependencies fail at startup with the detected chain and architecture
guidance. Service cycles are usually a sign that multiple bounded contexts or
responsibilities are being mixed into the same service.

## Why explicit `createApp` configuration?

BOX avoids filesystem auto-discovery, runtime reflection, and request-scoped
dependency resolution in the critical path because those features increase
serverless startup cost and reduce predictability.

The preferred pattern is:

```ts
const app = Box.createApp({
  authStrategies: [JwtAuthStrategy],
  controllers: [UsersController],
  services: [TokenService, UsersService],
  repositories: [UsersRepository],
  providers: [{ provide: Config, useValue: config }],
});
```

This style keeps dependencies visible, makes tests easier, resolves singletons
once at startup, fails closed for invalid auth/DI graphs, and preserves low cold
starts.
