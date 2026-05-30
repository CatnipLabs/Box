# Routes and Controllers

## Primary bootstrap API

Box's recommended application entrypoint is `createApp` with explicit
controller, service, repository, and provider lists:

```ts
const app = Box.createApp({
  controllers: [UsersController],
  services: [UsersService],
  repositories: [UsersRepository],
  providers: [{ provide: Config, useValue: config }],
  docs: { enabled: true, title: "Users API", version: "1.0.0" },
});
```

The returned app still exposes `fetch(request)` for Web Standard runtimes and
`use(middleware)` for cross-cutting middleware.

Route handlers may return a `Response` when they need full control, or return a
DTO directly. Box automatically serializes non-`Response` values as JSON.

## Path params, query string, and body

```ts
import { type Body, Box, type Param, type Query, z } from "@catniplabs/box";

const UserIdParams = z.object({ id: z.string().min(1) });
const UserQuery = z.object({ search: z.string().optional() });
const CreateUserRequest = z.object({ name: z.string().min(1) });

type UserIdParams = z.infer<typeof UserIdParams>;
type UserQuery = z.infer<typeof UserQuery>;
type CreateUserRequest = z.infer<typeof CreateUserRequest>;

@Box.Controller("/users")
class UsersController {
  @Box.Get(":id", { request: { params: UserIdParams, query: UserQuery } })
  public findById(input: Param<UserIdParams> & Query<UserQuery>) {
    return { id: input.params.id, search: input.query.search };
  }

  @Box.Post("/", {
    status: Box.HttpStatus.CREATED,
    request: { body: CreateUserRequest },
  })
  public create(input: Body<CreateUserRequest>) {
    return { id: crypto.randomUUID(), name: input.body.name };
  }
}
```

## Controllers with decorators

Controllers group routes by REST context. A controller class named
`UsersController` can be mounted under `/users` explicitly, or can rely on
inference when the class name is conventional.

```ts
@Box.Controller("/users", { deps: [UsersService] })
class UsersController {
  public constructor(private readonly users: UsersService) {}

  @Box.Get(":id", { request: { params: UserIdParams } })
  public async findById(input: Param<UserIdParams>) {
    return await this.users.getById(input.params.id);
  }

  @Box.Post("/", {
    status: Box.HttpStatus.CREATED,
    request: { body: CreateUserRequest },
  })
  public async create(input: Body<CreateUserRequest>) {
    return await this.users.create(input.body);
  }
}

const app = Box.createApp({
  controllers: [UsersController],
  services: [UsersService],
  repositories: [UsersRepository],
});
```

For irregular prefixes, pass one explicitly:

```ts
@Box.Controller("/admin/users")
class AdminUsersController {
  @Box.Get()
  public list() {
    return [{ id: "admin_1" }];
  }
}
```

## Route and controller auth

Protect a whole controller or a single endpoint with `@Box.Auth(...)`.

```ts
@Box.AuthStrategy({ name: "jwt", deps: [TokenService] })
class JwtAuthStrategy implements Box.AuthStrategyContract {
  constructor(private readonly tokens: TokenService) {}

  validate(ctx: Box.Context): boolean {
    const token = ctx.request.headers.get("authorization")
      ?.replace(/^Bearer\s+/i, "");
    return this.tokens.isValid(token);
  }
}

@Box.Controller("/admin")
@Box.Auth("jwt")
class AdminController {
  @Box.Get("/")
  public list() {
    return [{ id: "admin_1" }];
  }

  @Box.Get("/audit")
  @Box.Auth("jwt")
  public audit() {
    return { ok: true };
  }
}

const app = Box.createApp({
  authStrategies: [JwtAuthStrategy],
  controllers: [AdminController],
  services: [TokenService],
});
```

`@Box.Auth()` with no argument can be used when exactly one auth strategy is
registered. With multiple strategies, protected routes must specify the strategy
name or strategy class token. Legacy `Controller` subclasses can use route
options: `this.get("/", handler, { auth: "jwt" })`.

## Route options and Scalar/OpenAPI docs

Route options are attached directly to decorated methods. Zod schemas power
request validation and automatic Scalar/OpenAPI docs.

```ts
const CreateUserRequest = Box.z.object({ name: Box.z.string().min(1) });
const UserResponse = Box.z.object({ id: Box.z.string(), name: Box.z.string() });

type CreateUserRequest = Box.z.infer<typeof CreateUserRequest>;

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
    return { id: crypto.randomUUID(), name: input.body.name };
  }
}
```

Defaults applied by endpoint decorators:

- `summary` remains explicit because it is human-facing.
- `operationId` defaults to the decorated method name.
- `tags` defaults to the controller class name without the `Controller` suffix.
- `request.params` is inferred from route tokens such as `:id` as string params;
  pass an explicit Zod schema when params need stricter validation.
- Prefer `Box.HttpStatus` over numeric status codes in route metadata,
  responses, and exceptions.

## Legacy controller base class

The previous explicit controller base class remains supported for compatibility,
but new code should prefer decorated classes registered through `createApp`.

```ts
class LegacyUsersController extends Box.Controller {
  override readonly path = "/users";

  override routes() {
    return [this.get(":id", (ctx) => ({ id: ctx.params.id }))];
  }
}
```

## Middlewares

Middlewares follow the `ctx, next` pattern and are registered on the app
returned by `createApp`.

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

## CORS preflight

When `Box.cors()` is registered, the framework answers global preflights without
requiring you to manually declare an `OPTIONS` route for each endpoint.
