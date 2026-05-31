# BOX Framework

BOX is a TypeScript framework for REST APIs focused on simplicity, DDD, Web
Standards, serverless/edge runtimes, low cold starts, and a declarative
NestJS-style developer experience.

The project philosophy is to keep the request hot path extremely simple:

```text
Request -> Middleware -> Router -> Auth Strategy -> Zod validation -> Controller -> Service -> Repository -> Response
```

Decorators are first-class for controllers, services, repositories, and auth
strategies. Box still avoids runtime reflection, filesystem auto-discovery, and
a heavy HTTP core. Explicit `createApp(...)` configuration keeps startup
predictable in serverless.

## Framework goals

- Create REST APIs with a NestJS/C#-like experience using Controllers, Services,
  Repositories, and domain entities.
- Parse and validate request input before controller methods run.
- Keep controllers decoupled from the raw request context.
- Resolve constructor dependencies through a simple singleton DI container.
- Protect controllers/endpoints with application-owned auth strategies that
  receive the full request context.
- Fail fast during startup when DI boundaries, auth strategy selection, or
  circular dependencies are invalid.
- Keep cold starts low for serverless and edge runtimes.
- Provide a lightweight ORM over Deno KV with typed CRUD and a fluent query
  builder.
- Standardize error responses with a universal contract.
- Include modern security: built-in CORS, secure headers inspired by Helmet,
  payload limits, Deno KV-backed rate limiting, and request timing headers.

## Hello world

```ts
import { Box, type Param, z } from "@catniplabs/box";

const HelloParams = z.object({ name: z.string().min(1) });
type HelloParams = z.infer<typeof HelloParams>;

@Box.Controller("/health")
class HealthController {
  @Box.Get()
  public health(): { ok: true } {
    return { ok: true };
  }
}

@Box.Controller("/hello")
class HelloController {
  @Box.Get(":name", { request: { params: HelloParams } })
  public hello(input: Param<HelloParams>): { hello: string } {
    return { hello: input.params.name };
  }
}

const app = Box.createApp({
  controllers: [HealthController, HelloController],
});

export default {
  fetch: (request: Request) => app.fetch(request),
};
```

## Public modules

| Submodule                                   | Usage                                                                                   |
| ------------------------------------------- | --------------------------------------------------------------------------------------- |
| `@catniplabs/box` or `@catniplabs/box/http` | HTTP core, decorators, `createApp`, auth strategies, middlewares, responses, and errors |
| `@catniplabs/box/core`                      | Explicit DI container, providers, and injectable metadata                               |
| `@catniplabs/box/orm`                       | Persistence and `KvRepository` for Deno KV                                              |
| `@catniplabs/box/background-jobs`           | Deno Cron scheduler helpers, `BackgroundJob`, `JobSchedule`, and KV locking             |
| `@catniplabs/box/messaging`                 | Deno Queue runtime helpers for producers and consumers                                  |
| `@catniplabs/box/logger`                    | Structured logger                                                                       |
| `@catniplabs/box/adapters/deno`             | Adapter to run with local/server Deno                                                   |

## Enterprise-style example

```ts
import { Box, type Param, z } from "@catniplabs/box";

const UserIdParams = z.object({ id: z.string().min(1) });
type UserIdParams = z.infer<typeof UserIdParams>;

class User extends Box.Entity<string> {
  public constructor(
    id: string,
    public readonly name: string,
    public readonly active: boolean,
  ) {
    super(id);
  }
}

class KvDatabase {
  public constructor(public readonly kv: Deno.Kv) {}
}

@Box.Repository({ deps: [KvDatabase] })
class UsersRepository extends Box.KvRepository<User> {
  public constructor(database: KvDatabase) {
    super(User, database.kv, { collection: "users" });
  }
}

@Box.Service({ deps: [UsersRepository] })
class UsersService {
  public constructor(private readonly users: UsersRepository) {}

  public async getById(id: string): Promise<User> {
    const user = await this.users.findById(id);
    if (!user) {
      throw new Box.HttpError(404, "User not found", "user_not_found", { id });
    }
    return user;
  }
}

@Box.Controller("/users", { deps: [UsersService] })
class UsersController {
  public constructor(private readonly users: UsersService) {}

  @Box.Get(":id", { request: { params: UserIdParams } })
  public async findById(input: Param<UserIdParams>): Promise<User> {
    return await this.users.getById(input.params.id);
  }
}

const kv = await Deno.openKv();
const app = Box.createApp({
  controllers: [UsersController],
  services: [UsersService],
  repositories: [UsersRepository],
  providers: [{ provide: KvDatabase, useValue: new KvDatabase(kv) }],
});

app.use(Box.secureHeaders());
app.use(Box.cors({ origin: ["https://app.example.com"] }));
app.use(Box.requestLogger({ logger: new Box.Log.Logger({ name: "api" }) }));

export default {
  fetch: (request: Request) => app.fetch(request),
};
```

## Documentation pages

- [Getting Started](Getting-Started)
- [Architecture and DDD](Architecture-and-DDD)
- [Routes and Controllers](Routes-and-Controllers)
- [Services and Repositories](Services-and-Repositories)
- [Auth Strategies](Auth-Strategies)
- [ORM with Deno KV](ORM-with-Deno-KV)
- [Messaging with Deno Queues](Messaging-with-Deno-Queues)
- [Background Jobs with Deno Cron](Background-Jobs-with-Deno-Cron)
- [Logs, Errors, and Exceptions](Logs-Errors-and-Exceptions)
- [Security](Security)
- [Serverless and Performance](Serverless-and-Performance)
- [Tests and Contributing](Tests-and-Contributing)

## Current status

The documentation reflects the current state of the `CatnipLabs/Box` repository
on the `main` branch.

Currently implemented features:

- REST App with Fetch API.
- Controller and endpoint decorators.
- Typed request inputs (`Body`, `Param`, `Query`, `Header`, `RequestInput`).
- Zod-backed validation and OpenAPI/Scalar docs.
- `createApp` with singleton DI, custom providers, services, repositories, and
  auth strategies.
- Startup validation for DI boundaries, invalid auth selection, and circular
  dependencies.
- Base controllers, services, repositories, and entities for DDD.
- `KvRepository` over Deno KV.
- Deno Queues messaging with events, producers, and consumers.
- Deno Cron background jobs with `JobSchedule` presets and Deno KV distributed
  locking.
- Response helpers.
- Body helpers with byte limits.
- Custom exceptions through `HttpError`.
- Universal error contract.
- CORS, secure headers, auth strategies, payload limits, Deno KV-backed rate
  limiting, and request timing headers.
- Structured logger and request logging.
- Unit, integration, and performance tests, benchmarks, and cold start
  measurement.
