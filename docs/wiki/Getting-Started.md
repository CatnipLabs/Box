# Getting Started

## Requirements

- A current Deno version.
- TypeScript.
- A Fetch API-compatible runtime for serverless/edge deployment.

## Minimal structure

```ts
import { Box } from "@catniplabs/box";

const app = new Box.App();

app.get("/health", () => Box.json({ ok: true }));

export default {
  fetch: (request: Request) => app.fetch(request),
};
```

During development inside the repository, examples use:

```ts
import { Box } from "../../src/mod.ts";
```

In a package consumer, use the public package import:

```ts
import { Box } from "@catniplabs/box";
```

## Running locally with Deno

For an app exported as a Fetch handler, use the Deno adapter:

```ts
import { serve } from "@catniplabs/box/adapters/deno";
import app from "./app.ts";

serve(app);
```

## Basic routes

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

## Handler context

Each handler receives a simple context:

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

## Response helpers

```ts
Box.json({ ok: true });
Box.text("ok");
Box.empty();
Box.redirect("https://example.com");
```

## Project commands

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
