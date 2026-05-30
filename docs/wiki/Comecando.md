# Começando

## Requisitos

- Deno atual.
- TypeScript.
- Runtime compatível com Fetch API para deploy serverless/edge.

## Estrutura mínima

```ts
import { Box } from "box";

const app = new Box.App();

app.get("/health", () => Box.json({ ok: true }));

export default {
  fetch: (request: Request) => app.fetch(request),
};
```

Durante o desenvolvimento dentro do repositório, os exemplos usam:

```ts
import { Box } from "../../src/mod.ts";
```

Em um consumidor do pacote, use o import público configurado pelo pacote:

```ts
import { Box } from "box";
```

## Rodando localmente com Deno

Para um app exportado como Fetch handler, use o adapter Deno:

```ts
import { serve } from "box/adapters/deno";
import app from "./app.ts";

serve(app);
```

## Rotas básicas

```ts
const app = new Box.App();

app.get("/users/:id", (ctx) => {
  return Box.json({
    id: ctx.params.id,
    page: ctx.query.get("page") ?? "1",
  });
});

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

## Contexto do handler

Cada handler recebe um contexto simples:

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

## Helpers de response

```ts
Box.json({ ok: true });
Box.text("ok");
Box.empty();
Box.redirect("https://example.com");
```

## Comandos do projeto

```bash
deno task fmt
deno task lint
deno task check
deno task test
deno task test:unit
deno task test:integration
deno task test:performance
deno task coverage
deno task bench
deno run scripts/measure_startup.ts
```
