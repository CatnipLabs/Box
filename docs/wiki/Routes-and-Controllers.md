# Routes and Controllers

## Supported App methods

```ts
app.get(path, handler);
app.post(path, handler);
app.put(path, handler);
app.patch(path, handler);
app.delete(path, handler);
app.options(path, handler);
app.head(path, handler);
app.controller(controller);
app.fetch(request);
```

## Path params and query string

```ts
app.get("/users/:id", (ctx) => {
  return Box.json({
    id: ctx.params.id,
    search: ctx.query.get("q"),
  });
});
```

## Controllers

Controllers group routes by REST context.

```ts
class UsersController extends Box.Controller {
  override readonly path = "/users";

  constructor(private readonly users: UsersService) {
    super();
  }

  override routes() {
    return [
      this.get(":id", (ctx) => this.findById(ctx)),
      this.post("/", (ctx) => this.create(ctx)),
      this.put(":id", (ctx) => this.update(ctx)),
      this.delete(":id", (ctx) => this.remove(ctx)),
    ];
  }

  private async findById(ctx) {
    const user = await this.users.getById(ctx.params.id);
    return Box.json(user);
  }
}
```

## Helpers available in Controller

```ts
this.get(path, handler);
this.post(path, handler);
this.put(path, handler);
this.patch(path, handler);
this.delete(path, handler);
this.options(path, handler);
this.head(path, handler);
```

## Middlewares

Middlewares follow the `ctx, next` pattern.

```ts
app.use(async (ctx, next) => {
  const startedAt = performance.now();
  const response = await next();
  response.headers.set(
    "x-response-time-ms",
    String(performance.now() - startedAt),
  );
  return response;
});
```

## CORS preflight

When `Box.cors()` is registered, the framework answers global preflights without
requiring you to manually declare an `OPTIONS` route for each endpoint.
