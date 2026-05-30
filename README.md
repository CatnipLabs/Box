# Box

Box is a small TypeScript framework for REST APIs, focused on simplicity, Web
Standards, Serverless/Edge runtimes, and low cold starts.

The core idea is direct: `Request` in, `Response` out. No decorators,
reflection, filesystem auto-discovery, DI container, or heavy dependencies in
the HTTP core.

## Installation

```bash
deno add jsr:@catniplabs/box
```

Recommended imports:

```ts
import { Box } from "@catniplabs/box";
import { App, json } from "@catniplabs/box/http";
import { Controller, Entity, Repository, Service } from "@catniplabs/box/core";
import { KvRepository } from "@catniplabs/box/orm";
import { serve } from "@catniplabs/box/adapters/deno";
```

During local development in this repository, examples import from
`../../src/mod.ts`. In consumer applications, prefer the JSR imports above.

## Hello world

```ts
import { Box } from "@catniplabs/box";

const app = new Box.App();

app.get("/health", () => Box.json({ ok: true }));

export default {
  fetch: (request: Request) => app.fetch(request),
};
```

## Routes with params and query

```ts
const app = new Box.App();

app.get("/users/:id", (ctx) => {
  return Box.json({
    id: ctx.params.id,
    page: ctx.query.get("page") ?? "1",
  });
});
```

## Controllers, Services, Repositories, and DDD

For larger APIs, Box guides code toward a NestJS/C#-style flow, but without
decorators, reflection, or auto-discovery in the hot path. Registration is
explicit to preserve serverless cold starts.

```ts
import { Box } from "@catniplabs/box";

class User extends Box.Entity<string> {
  constructor(id: string, public readonly name: string) {
    super(id);
  }
}

class UsersRepository extends Box.Repository<User> {
  constructor() {
    super(User); // must be an entity that extends Box.Entity
  }

  findById(id: string): User | undefined {
    return id === "42" ? new User("42", "Ada") : undefined;
  }
}

class UsersService extends Box.Service {
  constructor(private readonly users: UsersRepository) {
    super();
  }

  getById(id: string): User | undefined {
    return this.users.findById(id);
  }
}

class UsersController extends Box.Controller {
  override readonly path = "/users";

  constructor(private readonly users: UsersService) {
    super();
  }

  override routes() {
    return [
      this.get(":id", (ctx) => {
        const user = this.users.getById(ctx.params.id);
        return Box.json({ id: user?.id, name: user?.name });
      }),
    ];
  }
}

const app = new Box.App();
app.controller(new UsersController(new UsersService(new UsersRepository())));
```

This pattern provides a simple DDD foundation:

- `Entity`: root base class for domain entities.
- `Repository<TEntity extends Entity>`: forces the repository to declare which
  domain entity it persists.
- `Service`: place for application/domain rules.
- `Controller`: exposes REST routes through explicit composition.

## ORM over Deno KV

Box's first ORM adapter is `KvRepository`, a lightweight abstraction over Deno
KV oriented around domain entities. Users do not write manual queries: they use
typed CRUD and a fluent query builder.

```ts
import { Box } from "@catniplabs/box";

class User extends Box.Entity<string> {
  constructor(
    id: string,
    public readonly name: string,
    public readonly age: number,
    public readonly active: boolean,
  ) {
    super(id);
  }
}

const kv = await Deno.openKv();
const users = new Box.KvRepository(User, kv, { collection: "users" });

await users.save(new User("u1", "Ada", 37, true));

const adults = await users
  .query()
  .where("active", "eq", true)
  .where("age", "gte", 18)
  .orderBy("age", "desc")
  .limit(10)
  .all();
```

The repository hydrates the concrete entity again, so domain class methods
remain available after `findById`, `all`, or `first`.

Initial query builder operators:

- `eq`
- `ne`
- `gt`
- `gte`
- `lt`
- `lte`
- `contains`

The current implementation scans by collection prefix (`[collection, id]`) and
applies filters in memory. When there is no `orderBy`, `limit()`/`offset()` stop
early so they do not iterate more items than needed to fill the page. Ordered
queries still need to materialize candidates before sorting. For large
production queries, model access patterns/secondary indexes over Deno KV before
depending on global scans.

By default, the KV mapper rehydrates the entity through its prototype to
preserve methods without calling the constructor. This is convenient for simple
entities, but it can bypass domain invariants. For rich entities, provide an
explicit `mapper` or `hydrator`:

```ts
const users = new Box.KvRepository(User, kv, {
  collection: "users",
  hydrator: (value) =>
    new User(
      String(value.id),
      String(value.name),
      Number(value.age),
      Boolean(value.active),
    ),
});
```

## Supported methods

- `app.get(path, handler, options?)`
- `app.post(path, handler, options?)`
- `app.put(path, handler, options?)`
- `app.patch(path, handler, options?)`
- `app.delete(path, handler, options?)`
- `app.options(path, handler, options?)`
- `app.head(path, handler, options?)`
- `app.controller(controller)`
- `app.fetch(request)`

## Handler context

Each handler receives a simple object:

```ts
interface Context {
  request: Request;
  url: URL;
  params: Record<string, string>;
  query: URLSearchParams;
  state: Record<string, unknown>;
  validated: {
    params?: unknown;
    query?: unknown;
    headers?: unknown;
    body?: unknown;
  };
  json<T>(options?: { maxBytes?: number }): Promise<T>;
  text(options?: { maxBytes?: number }): Promise<string>;
}
```

## OpenAPI + Scalar documentation with Zod

Box generates `/openapi.json` and a polished Scalar page at `/docs` from the Zod
contracts declared on routes. Documentation is only exposed when you explicitly
enable `docs`, so it is easy to enable in dev/staging and disable in production.

```ts
import { Box, z } from "@catniplabs/box";

const app = new Box.App({
  docs: {
    enabled: Deno.env.get("ENVIRONMENT") !== "production",
    title: "Users API",
    version: "1.0.0",
    description: "REST API generated by Box",
  },
});

const CreateUserRequest = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

const UserResponse = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
});

app.post("/users", (ctx) => {
  const body = ctx.validated.body as z.infer<typeof CreateUserRequest>;
  return Box.json({ id: crypto.randomUUID(), ...body }, { status: 201 });
}, {
  summary: "Create user",
  operationId: "createUser",
  tags: ["Users"],
  request: { body: CreateUserRequest },
  responses: {
    201: { description: "User created", body: UserResponse },
  },
});
```

The same API works in controllers:

```ts
class UsersController extends Box.Controller {
  override readonly path = "/users";

  override routes() {
    return [
      this.get(":id", (ctx) => Box.json({ id: ctx.params.id }), {
        summary: "Find user",
        tags: ["Users"],
        request: {
          params: z.object({ id: z.string().uuid() }),
          query: z.object({ includeInactive: z.coerce.boolean().optional() }),
        },
        responses: { 200: { description: "User found", body: UserResponse } },
      }),
    ];
  }
}
```

Important details:

- `request.params`, `request.query`, `request.headers`, and `request.body`
  accept Zod schemas.
- The request is validated before the handler; when invalid, Box returns `400`
  using the universal error contract.
- Values parsed/coerced by Zod are available in `ctx.validated`.
- `request.bodyMaxBytes` limits the validated JSON size, with the safe `1MB`
  default inherited from the HTTP parser.
- Routes with `{ docs: false }` do not appear in OpenAPI.
- To change paths: `docs: { path: "/reference", openApiPath: "/schema.json" }`.

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

## Logs

Box includes a lightweight, dependency-free logger with NestJS-style levels and
structured records for production. The configured level works as a threshold:
`INFO` emits `ERROR`, `WARN`, and `INFO`, but ignores `DEBUG` and `TRACE`.

```ts
const logger = new Box.Log.Logger({
  name: "UsersService",
  level: Box.Log.Levels.INFO,
});

logger.info("user created", { userId: "usr_123" });
logger.debug("internal details"); // ignored when level = INFO
```

For HTTP access logs, use the explicit `requestLogger` middleware. It records
method, path, status, duration, and `requestId`/`correlationId` when the header
is present, without adding auto-scan or decorators to the cold start path:

```ts
app.use(Box.requestLogger({ logger }));
```

Logs can also be sent to a structured sink, useful in serverless environments
for collectors or tests:

```ts
const logger = new Box.Log.Logger({
  name: "api",
  level: Box.Log.Levels.INFO,
  sink: (record) => {
    console.log(JSON.stringify(record));
  },
});
```

## Security

The HTTP module includes a lightweight secure headers middleware, inspired by
Helmet but without an external dependency:

```ts
app.use(Box.secureHeaders());
```

Default headers:

- `x-content-type-options: nosniff`
- `x-frame-options: DENY`
- `referrer-policy: no-referrer`
- `x-dns-prefetch-control: off`
- `cross-origin-opener-policy: same-origin`
- `cross-origin-resource-policy: same-origin`

HSTS is opt-in to avoid enabling permanent HTTPS policies during development:

```ts
app.use(Box.secureHeaders({
  strictTransportSecurity: "max-age=31536000; includeSubDomains; preload",
}));
```

The middleware does not overwrite headers already defined by the handler and
allows each header to be disabled or changed through options.

CORS is also built in and works for real requests and global preflight without
manually registering an `OPTIONS` route:

```ts
app.use(Box.cors({
  origin: ["https://app.example.com"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["authorization", "content-type"],
  credentials: true,
  maxAge: 600,
}));
```

By default, `origin` is `"*"`. For APIs with cookies/credentials, configure an
explicit allowlist; `credentials: true` with wildcard is rejected at startup to
avoid an invalid browser configuration.

## Responses

```ts
Box.json({ ok: true });
Box.text("ok");
Box.empty();
Box.redirect("https://example.com");
```

## HTTP errors and custom exceptions

```ts
class UserNotFound extends Box.HttpError {
  constructor(id: string) {
    super(404, "User not found", "user_not_found", { id });
  }
}

app.get("/users/:id", () => {
  throw new UserNotFound("42");
});
```

Unexpected errors return `500` with a safe response, without leaking stack
traces. All error responses follow the universal contract:

```json
{
  "success": false,
  "error": {
    "statusCode": 404,
    "code": "user_not_found",
    "message": "User not found",
    "details": { "id": "42" },
    "path": "/users/42",
    "method": "GET",
    "requestId": "req-123",
    "timestamp": "2026-05-29T20:00:00.000Z"
  }
}
```

`requestId` is filled automatically from the `x-request-id` or
`x-correlation-id` headers when present.

## Body helpers

`ctx.json()` and `ctx.text()` apply a size limit through `Content-Length` before
consuming the stream and also stop reading as soon as the real limit is
exceeded. This avoids materializing large payloads in memory in serverless
runtimes.

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

The core uses the native Fetch API. This lets the same app run in Fetch-first
runtimes such as Deno Deploy, Cloudflare Workers, and other Edge environments.

For local/server Deno:

```ts
import { serve } from "@catniplabs/box/adapters/deno";
import app from "./app.ts";

serve(app);
```

## Examples

- `examples/hello-world/main.ts`
- `examples/rest-api/main.ts`

## Development

```bash
deno task fmt
deno task lint
deno task check
deno task test
deno task bench
```

Simple cold start measurement:

```bash
deno run scripts/measure_startup.ts
```

## Submodules

- `@catniplabs/box`: convenience bundle with HTTP, DDD, ORM, and logger.
- `@catniplabs/box/http`: lightweight HTTP core for serverless hot paths.
- `@catniplabs/box/core`: DDD bases (`Entity`, `Repository`, `Service`,
  `Controller`).
- `@catniplabs/box/orm`: persistence abstractions, including `KvRepository` for
  Deno KV.
- `@catniplabs/box/adapters/deno`: Deno adapter.
- `@catniplabs/box/logger`: structured logger, kept outside the HTTP core hot
  path.
