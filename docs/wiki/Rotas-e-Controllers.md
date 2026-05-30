# Rotas e Controllers

## Métodos suportados no App

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

## Path params e query string

```ts
app.get("/users/:id", (ctx) => {
  return Box.json({
    id: ctx.params.id,
    search: ctx.query.get("q"),
  });
});
```

## Controllers

Controllers agrupam rotas por contexto REST.

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

## Helpers disponíveis em Controller

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

Middlewares seguem o padrão `ctx, next`.

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

## Preflight CORS

Quando `Box.cors()` está registrado, o framework responde preflights globais sem
exigir que você declare manualmente uma rota `OPTIONS` para cada endpoint.
