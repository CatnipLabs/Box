# Box

Box is a small TypeScript framework for REST APIs, focused on simplicity, Web
Standards, Serverless/Edge runtimes, low cold starts, and a declarative
NestJS-style developer experience.

The primary API is controller-first:

```text
Request -> Middleware -> Router -> Auth Strategy -> Zod validation -> Controller -> Service -> Repository -> Response
```

Controllers, services, repositories, and auth strategies are declared with
lightweight decorators. Dependencies are resolved once during `createApp(...)`
startup through an explicit singleton DI container. Box intentionally avoids
filesystem auto-discovery, `reflect-metadata`, and request-scoped DI in the core
hot path.

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

@Box.Controller("/health")
class HealthController {
  @Box.Get()
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
    status: Box.HttpStatus.CREATED,
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
    if (!user) {
      throw new Box.HttpError(
        Box.HttpStatus.NOT_FOUND,
        "User not found",
        "user_not_found",
      );
    }
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

Box validates dependency boundaries at startup:

- controllers may inject services only;
- services may inject services, repositories, or producers only;
- producers may inject services only;
- consumers may inject services only;
- auth strategies may inject services or other auth strategies only;
- repositories may inject repositories or explicit provider tokens only;
- circular dependency graphs fail fast with a message that points to the cycle
  and explains the likely architecture smell.

## Messaging with Deno Queues

Use `Event`, `Producer`, and `Consumer` for background work backed by Deno KV
Queues.

```ts
import { Box } from "@catniplabs/box";

@Box.Event({ name: "orders.created" })
class OrderCreatedEvent extends Box.Event<{ orderId: string }> {}

@Box.Producer({ event: OrderCreatedEvent })
class OrderCreatedProducer extends Box.Producer<OrderCreatedEvent> {}

@Box.Service({ deps: [OrderCreatedProducer] })
class OrdersService {
  public constructor(private readonly producer: OrderCreatedProducer) {}

  public async create(orderId: string): Promise<void> {
    await this.producer.publish({ orderId }, {
      backoffSchedule: [1_000, 5_000, 10_000],
      keysIfUndelivered: [["failed_orders", orderId]],
    });
  }
}

@Box.Consumer({ event: OrderCreatedEvent, deps: [OrdersService] })
class OrderCreatedConsumer extends Box.Consumer<OrderCreatedEvent> {
  public constructor(private readonly orders: OrdersService) {
    super();
  }

  public async handle(event: OrderCreatedEvent): Promise<void> {
    // Deno Queues are at-least-once: make side effects idempotent.
    await saveOrderProjection(event.payload.orderId, event.id);
  }
}

const kv = await Deno.openKv();
const app = Box.createApp({
  controllers: [OrdersController],
  services: [OrdersService],
  producers: [OrderCreatedProducer],
  consumers: [OrderCreatedConsumer],
  queues: Box.denoQueues({ kv }),
});
```

`publish` forwards Deno queue options such as `delay`, `backoffSchedule`, and
`keysIfUndelivered`. Local runs may require `--unstable-kv` depending on the
Deno version.

## Auth strategies

Auth is implemented with application-owned strategies. A strategy receives the
full request `Context`, so it can validate a JWT bearer token, cookie, API key,
tenant header, or any custom source, and can write claims to `ctx.state`.

```ts
import { type AuthStrategyContract, Box, type Context } from "@catniplabs/box";

@Box.Service()
class TokenService {
  isValid(token: string | undefined): boolean {
    return token === "valid-jwt";
  }
}

@Box.AuthStrategy({ name: "jwt", deps: [TokenService] })
class JwtAuthStrategy implements AuthStrategyContract {
  constructor(private readonly tokens: TokenService) {}

  validate(ctx: Context): boolean {
    const token = ctx.request.headers.get("authorization")
      ?.replace(/^Bearer\s+/i, "");

    if (!this.tokens.isValid(token)) return false;

    ctx.state.user = { id: "user_1" };
    return true;
  }
}

@Box.Controller("/admin")
@Box.Auth("jwt")
class AdminController {
  @Box.Get("/")
  list() {
    return { ok: true };
  }
}

const app = Box.createApp({
  authStrategies: [JwtAuthStrategy],
  controllers: [AdminController],
  services: [TokenService],
});
```

Use `@Box.Auth()` without an argument only when the application registers a
single auth strategy. If a protected endpoint has no strategy, or multiple
strategies are registered and no specific strategy is selected, `createApp(...)`
fails during startup. Strategy names must be non-empty and unique, and classes
passed to `authStrategies` must be decorated with `@Box.AuthStrategy(...)`.

Auth runs after route matching and before Zod request validation. Strategies may
return `true`/`undefined` to continue, `false` for `401 Unauthorized`, a custom
`Response` to short-circuit, or throw `Box.HttpError` to use the universal error
pipeline.

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
    status: Box.HttpStatus.CREATED,
    summary: "Create user",
    request: { body: CreateUserRequest },
    responses: {
      [Box.HttpStatus.CREATED]: {
        description: "User created",
        body: UserResponse,
      },
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

- `summary` is normally handwritten because it is human-facing.
- `operationId` defaults to the controller method name, for example `findById`.
- `tags` default to the controller class name without the `Controller` suffix.
- `request.params` is inferred from route tokens such as `:id` as string params;
  provide a Zod schema only when you need stricter rules such as UUIDs.
- `request.params`, `request.query`, `request.headers`, and `request.body`
  accept explicit Zod schemas.
- Use `Box.HttpStatus` instead of numeric status codes in route metadata and
  exceptions.
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
const kv = await Deno.openKv();

app.use(Box.secureHeaders());
app.use(Box.cors({ origin: ["https://app.example.com"] }));
app.use(Box.requestLogger({ logger }));
app.use(Box.requestTime());
app.use(Box.payloadLimit({
  jsonMaxBytes: Box.RequestSizeLimit.MB1,
  uploadMaxBytes: Box.RequestSizeLimit.MB10,
  defaultMaxBytes: Box.RequestSizeLimit.MB1,
}));
app.use(Box.rateLimit({
  kv,
  limit: 100,
  windowMs: 60_000,
  namespace: "public-api",
}));
```

`payloadLimit` treats `application/json` and `application/*+json` as JSON,
`multipart/form-data` and `application/octet-stream` as uploads, and all other
bodies with `defaultMaxBytes`. `RequestSizeLimit` exposes common byte constants
such as `KB16`, `MB1`, `MB10`, and `MB100` so applications do not need to repeat
raw numbers.

`rateLimit` uses Deno KV atomic operations, so all instances sharing the same KV
store share the same IP/identifier buckets. By default it reads
`cf-connecting-ip`, `x-real-ip`, then the first `x-forwarded-for` value; pass
`identifier` when your production proxy/CDN trust boundary requires a custom
key.

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

- `examples/hello-world/main.ts` — minimal controller and typed params.
- `examples/rest-api/main.ts` — services, repositories, auth strategy, docs,
  middlewares, and universal errors.
- `examples/auth-strategy/main.ts` — focused API-key auth strategy example.

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

- `@catniplabs/box`: convenience bundle with HTTP, DDD, ORM, logger, auth
  strategy helpers, and `z`.
- `@catniplabs/box/http`: lightweight HTTP core for serverless hot paths,
  including auth strategy contracts and runtime helpers.
- `@catniplabs/box/core`: explicit DI container and resource metadata.
- `@catniplabs/box/orm`: persistence abstractions, including `KvRepository` for
  Deno KV.
- `@catniplabs/box/adapters/deno`: Deno adapter.
- `@catniplabs/box/logger`: structured logger, kept outside the HTTP core hot
  path.
