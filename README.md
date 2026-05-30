# Box

Box é um framework pequeno para APIs REST em TypeScript, focado em simplicidade,
Web Standards, Serverless/Edge e baixo cold start.

A ideia central é direta: `Request` entra, `Response` sai. Sem decorators,
reflection, auto-discovery por filesystem, DI container ou dependências pesadas
no core HTTP.

## Hello world

```ts
import { Box } from "box";

const app = new Box.App();

app.get("/health", () => Box.json({ ok: true }));

export default {
  fetch: (request: Request) => app.fetch(request),
};
```

## Rotas com params e query

```ts
const app = new Box.App();

app.get("/users/:id", (ctx) => {
  return Box.json({
    id: ctx.params.id,
    page: ctx.query.get("page") ?? "1",
  });
});
```

## Controllers, Services, Repositories e DDD

Para APIs maiores, o Box orienta o código para um fluxo parecido com NestJS/C#,
mas sem decorators, reflection ou auto-discovery no caminho quente. O registro é
explícito para preservar cold start em serverless.

```ts
import { Box } from "box";

class User extends Box.Entity<string> {
  constructor(id: string, public readonly name: string) {
    super(id);
  }
}

class UsersRepository extends Box.Repository<User> {
  constructor() {
    super(User); // precisa ser uma entidade que estende Box.Entity
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

Esse padrão dá uma base DDD simples:

- `Entity`: raiz de entidade de domínio.
- `Repository<TEntity extends Entity>`: força o repositório a declarar qual
  entidade de domínio ele persiste.
- `Service`: ponto para regras de aplicação/domínio.
- `Controller`: expõe rotas REST por composição explícita.

## ORM sobre Deno KV

O primeiro adapter ORM do Box é o `KvRepository`, uma abstração leve sobre Deno
KV orientada a entidades de domínio. O usuário não escreve queries manuais: ele
usa CRUD tipado e um query builder fluente.

```ts
import { Box } from "box";

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

O repositório hidrata novamente a entidade concreta, então métodos da classe de
domínio continuam disponíveis após `findById`, `all` ou `first`.

Operadores iniciais do query builder:

- `eq`
- `ne`
- `gt`
- `gte`
- `lt`
- `lte`
- `contains`

A implementação atual faz scan por prefixo da collection (`[collection, id]`) e
aplica filtros em memória. Isso entrega DX simples agora sem acoplar o core a
reflection/decorators. Para consultas grandes em produção, a próxima etapa será
adicionar índices/materialized access patterns sobre Deno KV.

## Métodos suportados

- `app.get(path, handler)`
- `app.post(path, handler)`
- `app.put(path, handler)`
- `app.patch(path, handler)`
- `app.delete(path, handler)`
- `app.options(path, handler)`
- `app.head(path, handler)`
- `app.controller(controller)`
- `app.fetch(request)`

## Contexto do handler

Cada handler recebe um objeto simples:

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

O Box inclui um logger leve, dependency-free, com níveis no estilo NestJS e
suporte a registros estruturados para produção. O nível configurado funciona
como threshold: `INFO` emite `ERROR`, `WARN` e `INFO`, mas ignora `DEBUG` e
`TRACE`.

```ts
const logger = new Box.Log.Logger({
  name: "UsersService",
  level: Box.Log.Levels.INFO,
});

logger.info("usuário criado", { userId: "usr_123" });
logger.debug("detalhes internos"); // ignorado quando level = INFO
```

Para access logs HTTP, use o middleware explícito `requestLogger`. Ele registra
método, path, status, duração e `requestId`/`correlationId` quando o header está
presente, sem adicionar auto-scan ou decorators ao cold start:

```ts
app.use(Box.requestLogger({ logger }));
```

Também é possível enviar logs para um sink estruturado, útil em serverless para
integrar com collectors ou testes:

```ts
const logger = new Box.Log.Logger({
  name: "api",
  level: Box.Log.Levels.INFO,
  sink: (record) => {
    console.log(JSON.stringify(record));
  },
});
```

## Segurança

O módulo HTTP já inclui um middleware leve de headers seguros, inspirado no
Helmet, mas sem dependência externa:

```ts
app.use(Box.secureHeaders());
```

Headers padrão:

- `x-content-type-options: nosniff`
- `x-frame-options: DENY`
- `referrer-policy: no-referrer`
- `x-dns-prefetch-control: off`
- `cross-origin-opener-policy: same-origin`
- `cross-origin-resource-policy: same-origin`

O middleware não sobrescreve headers já definidos pelo handler e permite
desabilitar/alterar cada header por opção.

CORS também é nativo e funciona para requests reais e preflight global sem
precisar registrar manualmente uma rota `OPTIONS`:

```ts
app.use(Box.cors({
  origin: ["https://app.example.com"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["authorization", "content-type"],
  credentials: true,
  maxAge: 600,
}));
```

Por padrão `origin` é `"*"`. Para APIs com cookies/credenciais, configure uma
allowlist explícita.

## Respostas

```ts
Box.json({ ok: true });
Box.text("ok");
Box.empty();
Box.redirect("https://example.com");
```

## Erros HTTP e custom exceptions

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

Erros inesperados retornam `500` com uma resposta segura, sem vazar stack trace.
Todas as respostas de erro seguem o contrato universal:

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

`requestId` é preenchido automaticamente a partir dos headers `x-request-id` ou
`x-correlation-id` quando presentes.

## Body helpers

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

O core usa a Fetch API nativa. Isso permite o mesmo app em runtimes Fetch-first
como Deno Deploy, Cloudflare Workers e outros ambientes Edge.

Para Deno local/server:

```ts
import { serve } from "box/adapters/deno";
import app from "./app.ts";

serve(app);
```

## Exemplos

- `examples/hello-world/main.ts`
- `examples/rest-api/main.ts`

## Desenvolvimento

```bash
deno task fmt
deno task lint
deno task check
deno task test
deno task bench
```

Medição simples de cold start:

```bash
deno run scripts/measure_startup.ts
```

## Submódulos

- `box` ou `box/http`: core HTTP.
- `box/core`: bases DDD (`Entity`, `Repository`, `Service`, `Controller`).
- `box/orm`: abstrações de persistência, incluindo `KvRepository` para Deno KV.
- `box/adapters/deno`: adapter Deno.
- `box/logger`: logger existente, mantido fora do caminho quente do core HTTP.
