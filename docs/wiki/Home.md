# BOX Framework

BOX é um framework TypeScript para APIs REST com foco em simplicidade, DDD, Web
Standards, serverless/edge e baixo cold start.

A filosofia do projeto é manter o caminho quente da request extremamente
simples:

```text
Request -> Middleware -> Controller/Handler -> Service -> Repository -> Response
```

Sem decorators obrigatórios, reflection, auto-discovery por filesystem ou DI
container pesado no core HTTP. O registro explícito é uma decisão de arquitetura
para preservar previsibilidade e performance em serverless.

## Objetivos do framework

- Criar APIs REST com uma experiência parecida com NestJS/C#, usando
  Controllers, Services, Repositories e entidades de domínio.
- Forçar uma base DDD simples: repositórios trabalham com entidades que estendem
  `Box.Entity`.
- Manter cold start baixo para serverless e edge runtimes.
- Oferecer ORM leve sobre Deno KV com CRUD tipado e query builder fluente.
- Padronizar respostas de erro com contrato universal.
- Oferecer logging estruturado no estilo NestJS, sem dependências pesadas.
- Incluir segurança moderna: CORS nativo e headers seguros inspirados no Helmet.
- Ser fácil de testar, medir e evoluir como projeto open source.

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

## Módulos públicos

O pacote expõe os seguintes submódulos:

| Submódulo                                   | Uso                                                        |
| ------------------------------------------- | ---------------------------------------------------------- |
| `@catniplabs/box` ou `@catniplabs/box/http` | Core HTTP, App, rotas, middlewares, responses e errors     |
| `@catniplabs/box/core`                      | Bases DDD: `Entity`, `Repository`, `Service`, `Controller` |
| `@catniplabs/box/orm`                       | Persistência e `KvRepository` para Deno KV                 |
| `@catniplabs/box/logger`                    | Logger estruturado                                         |
| `@catniplabs/box/adapters/deno`             | Adapter para rodar com Deno local/server                   |

## Exemplo enterprise-style

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

## Páginas da documentação

- [Começando](Comecando)
- [Arquitetura e DDD](Arquitetura-e-DDD)
- [Rotas e Controllers](Rotas-e-Controllers)
- [Services e Repositories](Services-e-Repositories)
- [ORM com Deno KV](ORM-com-Deno-KV)
- [Logs, Erros e Exceptions](Logs-Erros-e-Exceptions)
- [Segurança](Seguranca)
- [Serverless e Performance](Serverless-e-Performance)
- [Testes e Contribuição](Testes-e-Contribuicao)

## Status atual

A documentação reflete o estado atual do repositório `CatnipLabs/Box` na branch
`main`.

Recursos implementados atualmente:

- App REST com Fetch API.
- Rotas estáticas e parametrizadas.
- Controllers base com helpers HTTP.
- Services, Repositories e Entity base para DDD.
- `KvRepository` sobre Deno KV.
- Query builder com `where`, `orderBy`, `limit`, `offset`, `first` e `all`.
- Helpers de response.
- Helpers de body com limite de bytes.
- Custom exceptions via `HttpError`.
- Contrato universal de erro.
- CORS.
- Secure headers.
- Logger estruturado.
- Request logging.
- Testes unitários, integração, performance, benchmarks e medição de cold start.
