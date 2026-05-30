# BOX Framework

BOX is a TypeScript framework for REST APIs focused on simplicity, DDD, Web
Standards, serverless/edge runtimes, and low cold starts.

The project philosophy is to keep the request hot path extremely simple:

```text
Request -> Middleware -> Controller/Handler -> Service -> Repository -> Response
```

No mandatory decorators, reflection, filesystem auto-discovery, or heavy DI
container in the HTTP core. Explicit registration is an architecture decision to
preserve predictability and performance in serverless.

## Framework goals

- Create REST APIs with a NestJS/C#-like experience, using Controllers,
  Services, Repositories, and domain entities.
- Enforce a simple DDD foundation: repositories work with entities that extend
  `Box.Entity`.
- Keep cold starts low for serverless and edge runtimes.
- Provide a lightweight ORM over Deno KV with typed CRUD and a fluent query
  builder.
- Standardize error responses with a universal contract.
- Provide NestJS-style structured logging without heavy dependencies.
- Include modern security: built-in CORS and secure headers inspired by Helmet.
- Be easy to test, measure, and evolve as an open source project.

## Hello world

```ts
import { Box } from "@catniplabs/box";

const app = new Box.App();

app.get("/health", () => Box.json({ ok: true }));
app.get("/hello/:name", (ctx) => Box.json({ hello: ctx.params.name }));

export default {
  fetch: (request: Request) => app.fetch(request),
};
```

## Public modules

The package exposes the following submodules:

| Submodule                                   | Usage                                                      |
| ------------------------------------------- | ---------------------------------------------------------- |
| `@catniplabs/box` or `@catniplabs/box/http` | HTTP core, App, routes, middlewares, responses, and errors |
| `@catniplabs/box/core`                      | DDD bases: `Entity`, `Repository`, `Service`, `Controller` |
| `@catniplabs/box/orm`                       | Persistence and `KvRepository` for Deno KV                 |
| `@catniplabs/box/logger`                    | Structured logger                                          |
| `@catniplabs/box/adapters/deno`             | Adapter to run with local/server Deno                      |

## Enterprise-style example

```ts
import { Box } from "@catniplabs/box";

class User extends Box.Entity<string> {
  constructor(
    id: string,
    public readonly name: string,
    public readonly active: boolean,
  ) {
    super(id);
  }
}

class UsersRepository extends Box.KvRepository<User> {
  constructor(kv: Deno.Kv) {
    super(User, kv, { collection: "users" });
  }
}

class UsersService extends Box.Service {
  constructor(private readonly users: UsersRepository) {
    super();
  }

  async getById(id: string): Promise<User> {
    const user = await this.users.findById(id);
    if (!user) {
      throw new Box.HttpError(404, "User not found", "user_not_found", { id });
    }
    return user;
  }
}

class UsersController extends Box.Controller {
  override readonly path = "/users";

  constructor(private readonly users: UsersService) {
    super();
  }

  override routes() {
    return [
      this.get(":id", async (ctx) => {
        const user = await this.users.getById(ctx.params.id);
        return Box.json(user);
      }),
    ];
  }
}

const kv = await Deno.openKv();
const app = new Box.App();

app.use(Box.secureHeaders());
app.use(Box.cors({ origin: ["https://app.example.com"] }));
app.use(Box.requestLogger({ logger: new Box.Log.Logger({ name: "api" }) }));
app.controller(new UsersController(new UsersService(new UsersRepository(kv))));

export default {
  fetch: (request: Request) => app.fetch(request),
};
```

## Documentation pages

- [Getting Started](Getting-Started)
- [Architecture and DDD](Architecture-and-DDD)
- [Routes and Controllers](Routes-and-Controllers)
- [Services and Repositories](Services-and-Repositories)
- [ORM with Deno KV](ORM-with-Deno-KV)
- [Logs, Errors, and Exceptions](Logs-Errors-and-Exceptions)
- [Security](Security)
- [Serverless and Performance](Serverless-and-Performance)
- [Tests and Contributing](Tests-and-Contributing)

## Current status

The documentation reflects the current state of the `CatnipLabs/Box` repository
on the `main` branch.

Currently implemented features:

- REST App with Fetch API.
- Static and parameterized routes.
- Base controllers with HTTP helpers.
- Services, Repositories, and base Entity for DDD.
- `KvRepository` over Deno KV.
- Query builder with `where`, `orderBy`, `limit`, `offset`, `first`, and `all`.
- Response helpers.
- Body helpers with byte limits.
- Custom exceptions through `HttpError`.
- Universal error contract.
- CORS.
- Secure headers.
- Structured logger.
- Request logging.
- Unit, integration, and performance tests, benchmarks, and cold start
  measurement.
