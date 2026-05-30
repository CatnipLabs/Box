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

- Controller handles HTTP.
- Service centralizes application/domain rules.
- Repository persists and queries entities.
- Entity represents the domain.

## Base classes

### Entity

Every domain entity must extend `Box.Entity`.

```ts
class User extends Box.Entity<string> {
  constructor(id: string, public readonly name: string) {
    super(id);
  }
}
```

### Repository

Repositories must declare the entity they handle.

```ts
class UsersRepository extends Box.Repository<User> {
  constructor() {
    super(User);
  }
}
```

This forces framework users to associate persistence with a real domain entity.

### Service

Services extend `Box.Service` and are the recommended place for application
rules.

```ts
class UsersService extends Box.Service {
  constructor(private readonly users: UsersRepository) {
    super();
  }
}
```

### Controller

Controllers extend `Box.Controller`, declare `path`, and return routes
explicitly.

```ts
class UsersController extends Box.Controller {
  override readonly path = "/users";

  override routes() {
    return [
      this.get(":id", (ctx) => Box.json({ id: ctx.params.id })),
    ];
  }
}
```

## Why explicit registration?

BOX avoids filesystem auto-discovery, decorators, and reflection in the critical
path because these features increase serverless startup cost.

The preferred pattern is:

```ts
const app = new Box.App();
app.controller(new UsersController(new UsersService(new UsersRepository())));
```

This style keeps dependencies visible, makes tests easier, and reduces cold
starts.
