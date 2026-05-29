# Box

Box é um framework pequeno para APIs REST em TypeScript, focado em simplicidade,
Web Standards, Serverless/Edge e baixo cold start.

A ideia central é direta: `Request` entra, `Response` sai. Sem decorators,
reflection, auto-discovery por filesystem, DI container ou dependências pesadas
no core HTTP.

## Hello world

```ts
import { Box } from "box";

const app = new Box.App();

app.get("/health", () => Box.json({ ok: true }));

export default {
  fetch: (request: Request) => app.fetch(request),
};
```

## Rotas com params e query

```ts
const app = new Box.App();

app.get("/users/:id", (ctx) => {
  return Box.json({
    id: ctx.params.id,
    page: ctx.query.get("page") ?? "1",
  });
});
```

## Métodos suportados

- `app.get(path, handler)`
- `app.post(path, handler)`
- `app.put(path, handler)`
- `app.patch(path, handler)`
- `app.delete(path, handler)`
- `app.options(path, handler)`
- `app.head(path, handler)`
- `app.fetch(request)`

## Contexto do handler

Cada handler recebe um objeto simples:

```ts
interface Context {
  request: Request;
  url: URL;
  params: Record<string, string>;
  query: URLSearchParams;
  state: Record<string, unknown>;
  json<T>(options?: { maxBytes?: number }): Promise<T>;
  text(options?: { maxBytes?: number }): Promise<string>;
}
```

## Middlewares

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

## Respostas

```ts
Box.json({ ok: true });
Box.text("ok");
Box.empty();
Box.redirect("https://example.com");
```

## Erros HTTP

```ts
app.get("/users/:id", () => {
  throw new Box.HttpError(404, "User not found", "user_not_found");
});
```

Erros inesperados retornam `500` com uma resposta segura, sem vazar stack trace.

## Body helpers

```ts
app.post("/users", async (ctx) => {
  const body = await ctx.json<{ name?: string }>({ maxBytes: 16_384 });

  if (!body.name) {
    throw Box.badRequest("User name is required", { field: "name" });
  }

  return Box.json({ id: crypto.randomUUID(), name: body.name }, {
    status: 201,
  });
});
```

## Serverless/Edge

O core usa a Fetch API nativa. Isso permite o mesmo app em runtimes Fetch-first
como Deno Deploy, Cloudflare Workers e outros ambientes Edge.

Para Deno local/server:

```ts
import { serve } from "box/adapters/deno";
import app from "./app.ts";

serve(app);
```

## Exemplos

- `examples/hello-world/main.ts`
- `examples/rest-api/main.ts`

## Desenvolvimento

```bash
deno task fmt
deno task lint
deno task check
deno task test
deno task bench
```

Medição simples de cold start:

```bash
deno run scripts/measure_startup.ts
```

## Submódulos

- `box` ou `box/http`: core HTTP.
- `box/adapters/deno`: adapter Deno.
- `box/logger`: logger existente, mantido fora do caminho quente do core HTTP.
