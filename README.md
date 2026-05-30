# Box

Box is a small TypeScript framework for REST APIs, focused on simplicity, Web
Standards, Serverless/Edge runtimes, low cold starts, and a declarative
NestJS-style developer experience.

The primary API is controller-first:

```text
Request -> Middleware -> Router -> Zod validation -> Controller -> Service -> Repository -> Response
```

Controllers, services, and repositories are declared with lightweight
decorators. Dependencies are resolved once during `createApp(...)` startup
through an explicit singleton DI container. Box intentionally avoids filesystem
auto-discovery, `reflect-metadata`, and request-scoped DI in the core hot path.

## Installation

```bash
deno add jsr:@catniplabs/box
```

Recommended imports:

```ts
import { type Body, Box, type Param, z } from "@catniplabs/box";
import { serve } from "@catniplabs/box/adapters/deno";
```

During local development in this repository, examples import from
`../../src/mod.ts`. In consumer applications, prefer the JSR imports above.

## Hello world

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

## Typed params, query, and body

Route metadata owns request schemas. Box parses and validates before calling the
controller method, so handlers receive typed input instead of the raw request
context.

```ts
import { type Body, Box, type Param, z } from "@catniplabs/box";

const UserIdParams = z.object({ id: z.string().uuid() });
const CreateUserRequest = z.object({ name: z.string().min(1) });

type UserIdParams = z.infer<typeof UserIdParams>;
type CreateUserRequest = z.infer<typeof CreateUserRequest>;

@Box.Controller("/users")
class UsersController {
  @Box.Get(":id", { request: { params: UserIdParams } })
  public findById(input: Param<UserIdParams>) {
    return { id: input.params.id };
  }

  @Box.Post("/", {
    status: 201,
    request: { body: CreateUserRequest },
  })
  public create(input: Body<CreateUserRequest>) {
    return { id: crypto.randomUUID(), name: input.body.name };
  }
}

export default Box.createApp({
  controllers: [UsersController],
});
```

Useful input helper types:

- `Body<T>` -> `{ body: T }`
- `Param<T>` -> `{ params: T }`
- `Query<T>` -> `{ query: T }`
- `Header<T>` -> `{ headers: T }`
- `RequestInput<TBody, TQuery, TParams, THeaders>` for combined inputs

Parameter decorators such as `create(@Body() input)` are intentionally not the
primary API because Deno standard decorators do not support parameter decorators
without deprecated legacy compiler options.

## Controllers, Services, Repositories, and DI

For larger APIs, Box guides code toward a lightweight NestJS/C#-style flow.

```ts
import { Box, type Param, z } from "@catniplabs/box";

const UserIdParams = z.object({ id: z.string().min(1) });
type UserIdParams = z.infer<typeof UserIdParams>;

class User extends Box.Entity<string> {
  public constructor(id: string, public readonly name: string) {
    super(id);
  }
}

@Box.Repository()
class UsersRepository extends Box.Repository<User> {
  public constructor() {
    super(User);
  }

  public findById(id: string): User | undefined {
    return id === "42" ? new User("42", "Ada") : undefined;
  }
}

@Box.Service({ deps: [UsersRepository] })
class UsersService {
  public constructor(private readonly users: UsersRepository) {}

  public getById(id: string): User {
    const user = this.users.findById(id);
    if (!user) throw new Box.HttpError(404, "User not found", "user_not_found");
    return user;
  }
}

@Box.Controller("/users", { deps: [UsersService] })
class UsersController {
  public constructor(private readonly users: UsersService) {}

  @Box.Get(":id", { request: { params: UserIdParams } })
  public findById(input: Param<UserIdParams>): User {
    return this.users.getById(input.params.id);
  }
}

const app = Box.createApp({
  controllers: [UsersController],
  services: [UsersService],
  repositories: [UsersRepository],
});
```

`createApp` resolves all app classes once at startup and registers decorated
controller routes. Singleton is the default scope.

Custom providers are supported for configuration, interfaces, clocks, clients,
and factories:

```ts
const app = Box.createApp({
  controllers: [UsersController],
  services: [UsersService],
  repositories: [UsersRepository],
  providers: [
    { provide: Config, useValue: new Config("production") },
    { provide: Clock, useClass: SystemClock },
    {
      provide: TokenGenerator,
      deps: [Clock],
      useFactory: (clock: Clock) => new TokenGenerator(clock.now()),
    },
  ],
});
```

Dependency metadata can use `deps`, `inject`, or `dependencies`. Static
`inject`/`dependencies` remain supported for compatibility, but decorator
options are the recommended DX.

## OpenAPI + Scalar documentation with Zod

The same route metadata powers runtime validation and generated docs. Box
exposes `/openapi.json` and a Scalar UI at `/docs` only when docs are enabled.

```ts
const CreateUserRequest = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

const UserResponse = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
});

type CreateUserRequest = z.infer<typeof CreateUserRequest>;

@Box.Controller("/users")
class UsersController {
  @Box.Post("/", {
    status: 201,
    summary: "Create user",
    operationId: "createUser",
    tags: ["Users"],
    request: { body: CreateUserRequest },
    responses: {
      201: { description: "User created", body: UserResponse },
    },
  })
  public create(input: Body<CreateUserRequest>) {
    return { id: crypto.randomUUID(), ...input.body };
  }
}

const app = Box.createApp({
  controllers: [UsersController],
  docs: {
    enabled: Deno.env.get("ENVIRONMENT") !== "production",
    title: "Users API",
    version: "1.0.0",
  },
});
```

Important details:

- `request.params`, `request.query`, `request.headers`, and `request.body`
  accept Zod schemas.
- The request is validated before the controller method; invalid input returns
  `400` using the universal error contract.
- Parsed/coerced values are injected into the typed controller input.
- `request.bodyMaxBytes` limits validated JSON size, with a safe `1MB` default.
- Routes with `{ docs: false }` do not appear in OpenAPI.
- Docs paths can be customized with
  `docs: { path: "/reference", openApiPath: "/schema.json" }`.

## Middlewares

Middlewares are still registered on the app instance returned by `createApp`:

```ts
app.use(async (_ctx, next) => {
  const startedAt = performance.now();
  const response = await next();
  response.headers.set(
    "x-response-time-ms",
    String(performance.now() - startedAt),
  );
  return response;
});
```

Common built-ins:

```ts
app.use(Box.secureHeaders());
app.use(Box.cors({ origin: ["https://app.example.com"] }));
app.use(Box.requestLogger({ logger }));
```

## ORM over Deno KV

Box includes `KvRepository`, a lightweight abstraction over Deno KV oriented
around domain entities. It provides typed CRUD and a fluent query builder.

```ts
const kv = await Deno.openKv();
const users = new Box.KvRepository(User, kv, { collection: "users" });

await users.save(new User("u1", "Ada"));
const user = await users.findById("u1");
```

For rich entities, provide an explicit mapper or hydrator so persistence never
bypasses domain invariants accidentally.

## Logs and errors

```ts
const logger = new Box.Log.Logger({
  name: "UsersService",
  level: Box.Log.Levels.INFO,
});

logger.info("user created", { userId: "usr_123" });
```

Custom exceptions extend `HttpError` and can be thrown directly from services or
controllers:

```ts
class UserNotFound extends Box.HttpError {
  public constructor(id: string) {
    super(404, "User not found", "user_not_found", { id });
  }
}

@Box.Controller("/users")
class UsersController {
  @Box.Get(":id")
  public findById(): never {
    throw new UserNotFound("42");
  }
}
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
- `@catniplabs/box/core`: DDD bases and decorators (`Entity`, `Repository`,
  `Service`, `Controller`).
- `@catniplabs/box/orm`: persistence abstractions, including `KvRepository` for
  Deno KV.
- `@catniplabs/box/adapters/deno`: Deno adapter.
- `@catniplabs/box/logger`: structured logger, kept outside the HTTP core hot
  path.
