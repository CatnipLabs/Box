# Getting Started

## Requirements

- A current Deno version.
- TypeScript.
- A Fetch API-compatible runtime for serverless/edge deployment.

## Minimal structure

```ts
import { Box } from "@catniplabs/box";

@Box.Controller()
class HealthController {
  @Box.Get("/health")
  public health(): { ok: true } {
    return { ok: true };
  }
}

const app = Box.createApp({
  controllers: [HealthController],
});

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
import { type Body, Box, type Param, type Query, z } from "@catniplabs/box";

const UserIdParams = z.object({ id: z.string().min(1) });
const UserQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
});
const CreateUserRequest = z.object({ name: z.string().min(1) });

type UserIdParams = z.infer<typeof UserIdParams>;
type UserQuery = z.infer<typeof UserQuery>;
type CreateUserRequest = z.infer<typeof CreateUserRequest>;

@Box.Controller("/users")
class UsersController {
  @Box.Get(":id", { request: { params: UserIdParams, query: UserQuery } })
  public findById(input: Param<UserIdParams> & Query<UserQuery>) {
    return { id: input.params.id, page: input.query.page };
  }

  @Box.Post("/", {
    status: 201,
    request: { body: CreateUserRequest, bodyMaxBytes: 16_384 },
  })
  public create(input: Body<CreateUserRequest>) {
    return { id: crypto.randomUUID(), name: input.body.name };
  }
}

const app = Box.createApp({ controllers: [UsersController] });
```

## Controller input

Controller methods receive typed input assembled from validated schemas:

```ts
type Body<T> = { body: T };
type Param<T> = { params: T };
type Query<T> = { query: T };
type Header<T> = { headers: T };
```

This keeps application handlers decoupled from the raw request context while
preserving a small Web Standard core.

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
