# Plano: remover APIs low-level e melhorar defaults dos decorators de endpoint

## Objetivo

Evoluir a DX pública do Box para ficar 100% orientada a
`createApp + controllers + decorators`, removendo o uso direto de rotas
low-level e reduzindo repetição nos decorators de endpoint.

Escopo desejado:

- Remover suporte público a:
  - `app.get(...)`
  - `app.post(...)`
  - `app.put(...)`
  - `app.patch(...)`
  - `app.delete(...)`
  - `app.controller(...)`
- Manter o framework registrando rotas internamente via `createApp`.
- Preencher automaticamente metadados OpenAPI quando possível:
  - `operationId` a partir do nome do método do controller.
  - `tags` a partir do nome da classe controller, removendo o sufixo
    `Controller`.
  - `params` básicos a partir do path `:id`, quando `request.params` não for
    informado.
- Adicionar `HttpStatus` para evitar números mágicos em `status` e `responses`.

## Contexto atual

Arquivos relevantes:

- `src/presentation/http/app.ts`
  - Hoje expõe métodos públicos low-level: `get`, `post`, `put`, `patch`,
    `delete`, `options`, `head`, `route`, `controller`.
  - `createApp` depende de `app.controller(...)` para registrar controllers
    resolvidos pelo container.
- `src/presentation/http/create-app.ts`
  - Cria `App`, configura `Container`, resolve controllers e chama
    `app.controller(...)`.
- `src/presentation/controllers/route-decorators.ts`
  - Os decorators já recebem `context.name`; isso permite inferir `operationId`
    pelo nome do método.
- `src/presentation/controllers/controller-metadata-store.ts`
  - Já existe `getControllerPath(...)` e inferência de path pelo nome do
    controller.
  - Pode ganhar helper para inferir tag pelo nome da classe.
- `src/presentation/http/docs/create-openapi-document.util.ts`
  - Hoje usa `options.operationId` e `options.tags` somente quando enviados
    explicitamente.
  - Já documenta params de path como string quando aparecem em `:id`, mas isso é
    só documentação; não valida nem injeta em `ctx.validated` sem schema.
- `src/presentation/http/docs/route-options.interface.ts`
  - `status?: number` e `responses` usam status numérico/string como chave.

## Observação importante: inferir schema a partir do tipo da função

Não dá para inferir um schema Zod real a partir do tipo TypeScript do parâmetro
em runtime no Deno moderno.

Exemplo:

```ts
findById(input: Param<UserIdParams>)
```

Depois do build/runtime, `UserIdParams` é apenas tipo e é apagado. Sem
`emitDecoratorMetadata`/decorators legados/reflection, o framework não consegue
recuperar esse schema automaticamente.

Plano seguro:

1. Inferir automaticamente `params` básicos a partir do path (`:id` =>
   `z.object({ id: z.string() })`) quando nenhum `request.params` for fornecido.
2. Continuar permitindo schema explícito para validação forte:

```ts
@Get(":id", {
  request: { params: UserIdParams },
})
```

3. Documentar claramente essa limitação.
4. Se depois quisermos DX ainda melhor, criar uma API value-level opcional, por
   exemplo `Box.input({ params: UserIdParams })`, mas não misturar isso nesta
   mudança.

## Proposta de API final

### Antes

```ts
@Box.Get(":id", {
  summary: "Find user by id",
  operationId: "findUserById",
  tags: ["Users"],
  request: { params: UserIdParams },
  responses: {
    200: { description: "User found", body: UserResponse },
    404: { description: "User not found" },
  },
})
findById(input: Param<UserIdParams>) {
  return this.users.findById(input.params.id);
}
```

### Depois, para caso simples

```ts
@Box.Get(":id", {
  summary: "Find user by id",
  responses: {
    [Box.HttpStatus.OK]: { description: "User found", body: UserResponse },
    [Box.HttpStatus.NOT_FOUND]: { description: "User not found" },
  },
})
findById(input: Param<{ id: string }>) {
  return this.users.findById(input.params.id);
}
```

Gerado automaticamente:

- `operationId: "findById"`
- `tags: ["Users"]` para `UsersController`
- `request.params: z.object({ id: z.string() })` por causa do path `":id"`

### Depois, para validação customizada

```ts
@Box.Get(":id", {
  summary: "Find user by id",
  request: { params: UserIdParams },
  responses: {
    [Box.HttpStatus.OK]: { description: "User found", body: UserResponse },
    [Box.HttpStatus.NOT_FOUND]: { description: "User not found" },
  },
})
findById(input: Param<UserIdParams>) {
  return this.users.findById(input.params.id);
}
```

## Plano de implementação

### 1. Escrever testes RED para remoção das APIs low-level

Adicionar/ajustar testes em:

- `tests/unit/public-api/declarative_dx_test.ts`
- `tests/unit/public-api/mod_test.ts`
- possivelmente novo arquivo: `tests/unit/public-api/no_low_level_api_test.ts`

Validar em nível de TypeScript/runtime que o caminho público não expõe mais:

```ts
new Box.App().get;
new Box.App().post;
new Box.App().put;
new Box.App().patch;
new Box.App().delete;
new Box.App().controller;
```

Teste esperado:

```ts
assertEquals("get" in app, false);
assertEquals("post" in app, false);
assertEquals("controller" in app, false);
```

Também atualizar/remover testes legados que ainda dependem de `app.get` ou
`app.controller`.

### 2. Criar API interna de registro de rotas/controllers

Alterar `src/presentation/http/app.ts` para separar:

- API pública:
  - `fetch(request)`
  - `use(middleware)` se middleware continuar sendo público
  - `docs(options)` se docs runtime continuar público
- API interna:
  - registrar rota
  - registrar controller

Possíveis abordagens:

1. Funções exportadas internas, usadas só por `createApp`:

```ts
export function registerController(app: App, controller: object): void
export function registerRoute(app: App, ...): void
```

2. Métodos privados em `App` mais uma factory interna no mesmo arquivo.

Recomendação: usar funções internas exportadas com nome explícito, por exemplo:

```ts
registerControllerRoutes(app, controller);
```

Assim `createApp.ts` consegue usar sem deixar `app.controller(...)` público.

Arquivos prováveis:

- `src/presentation/http/app.ts`
- `src/presentation/http/create-app.ts`
- `src/presentation/http/index.ts`, se algum export público precisar ser
  ajustado

### 3. Atualizar `createApp` para não depender de `app.controller(...)`

Em `src/presentation/http/create-app.ts`, trocar:

```ts
app.controller(container.resolve(controller));
```

por algo como:

```ts
registerControllerRoutes(app, container.resolve(controller));
```

Garantir que a API pública continua sendo:

```ts
const app = Box.createApp({ controllers: [...] });
```

### 4. Adicionar `HttpStatus`

Criar arquivo novo, por exemplo:

```txt
src/presentation/http/status/http-status.enum.ts
```

ou mais simples:

```txt
src/presentation/http/http-status.enum.ts
```

Sugestão inicial:

```ts
export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  ACCEPTED = 202,
  NO_CONTENT = 204,
  MOVED_PERMANENTLY = 301,
  FOUND = 302,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  METHOD_NOT_ALLOWED = 405,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  TOO_MANY_REQUESTS = 429,
  INTERNAL_SERVER_ERROR = 500,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
}
```

Exportar em:

- `src/presentation/http/index.ts`
- `src/mod.ts`
- `Box.HttpStatus`

Atualizar tipos:

- `RouteOptions.status?: HttpStatus | number`
- `HttpError` pode continuar aceitando `number`, ou ganhar
  `HttpStatus | number`.

Adicionar teste público:

```ts
assertEquals(Box.HttpStatus.OK, 200);
```

### 5. Auto `operationId` a partir do método

Modificar o fluxo de metadata dos decorators:

- `src/presentation/controllers/route-decorators.ts` já tem `context.name`.
- `createDecoratedRoute(...)` já recebe `propertyKey`.

Ao registrar a rota, preencher `options.operationId` se estiver ausente:

```ts
operationId = options.operationId ?? String(route.propertyKey);
```

Melhor local: durante registro do controller, quando também temos acesso ao
controller para inferir tags.

Arquivos prováveis:

- `src/presentation/controllers/controller-metadata-store.ts`
- `src/presentation/http/app.ts`
- `src/presentation/http/docs/create-openapi-document.util.ts` se preferir
  enriquecer no momento de gerar docs

Recomendação: enriquecer no registro da rota, para a mesma metadata ser usada
por docs e runtime.

### 6. Auto `tags` a partir do nome do controller

Adicionar helper:

```ts
function inferControllerTag(className: string): string {
  return className.replace(/Controller$/, "") || className;
}
```

Exemplos:

- `UsersController` => `Users`
- `UserController` => `User`
- `AdminUsersController` => `AdminUsers`

Se o usuário informar `tags`, preservar o valor explícito:

```ts
options.tags ?? [inferControllerTag(controller.constructor.name)];
```

Adicionar teste OpenAPI garantindo:

```ts
operation.tags === ["Users"];
```

quando o controller for `UsersController`.

### 7. Auto `request.params` básico a partir do path

Criar helper, por exemplo:

```txt
src/presentation/controllers/infer-route-params-schema.util.ts
```

Comportamento:

- Se `options.request?.params` já existe, não alterar.
- Se o path não tem params, não criar schema.
- Se o path tem `:id`, `:orgId`, etc., criar:

```ts
z.object({ id: z.string(), orgId: z.string() });
```

Importante:

- Isso melhora validação e `input.params` para casos simples.
- Para regras como `uuid`, `min`, enum, etc., o usuário ainda deve passar schema
  explícito.

Teste esperado:

```ts
@Box.Controller("/users")
class UsersController {
  @Box.Get(":id")
  findById(input: Param<{ id: string }>) {
    return { id: input.params.id };
  }
}
```

Request:

```txt
GET /users/123
```

Deve retornar:

```json
{ "id": "123" }
```

E o OpenAPI deve documentar `id` como path param.

### 8. Atualizar OpenAPI tests

Adicionar/alterar testes em:

```txt
tests/unit/http/openapi_docs_test.ts
```

Cobrir:

- `operationId` automático pelo método.
- `tags` automático pelo controller.
- `operationId` explícito ainda sobrescreve o default.
- `tags` explícito ainda sobrescreve o default.
- params inferidos pelo path aparecem em OpenAPI.
- params inferidos pelo path também chegam no handler em `input.params`.
- schemas explícitos continuam funcionando.

### 9. Atualizar testes que ainda dependem de API low-level

Arquivos prováveis:

- `tests/unit/core/core_test.ts`
- `tests/unit/http/app_test.ts`
- `tests/unit/http/openapi_docs_test.ts`
- `tests/unit/http/security_test.ts`
- `tests/unit/http/hardening_test.ts`
- `tests/integration/rest_api_flow_test.ts`

Estratégia:

- Onde o teste valida comportamento HTTP genérico, criar controllers pequenos
  com decorators e `createApp`.
- Onde o teste realmente precisa testar router/middleware interno, usar seam
  interno controlado, não `app.get` público.
- Se algum teste testa explicitamente `ControllerBase.routes()`, decidir se esse
  legado também será removido ou mantido como camada interna/compatibilidade.
  Pela intenção atual, preferir não promovê-lo publicamente.

### 10. Atualizar exemplos e docs

Atualizar:

- `README.md`
- `docs/wiki/Routes-and-Controllers.md`
- `docs/wiki/Getting-Started.md`
- `docs/wiki/Home.md`
- `examples/rest-api/main.ts`
- `examples/hello-world/main.ts`

Trocar exemplos para usar:

```ts
Box.HttpStatus.CREATED;
Box.HttpStatus.OK;
Box.HttpStatus.NOT_FOUND;
```

E remover metadata redundante quando puder ser inferida:

```ts
@Box.Get(":id", {
  summary: "Find user by id",
  responses: {
    [Box.HttpStatus.OK]: { description: "User found", body: UserResponse },
    [Box.HttpStatus.NOT_FOUND]: { description: "User not found" },
  },
})
```

### 11. Atualizar contratos contra regressão

Fortalecer os testes já criados:

- `tests/unit/examples/examples_contract_test.ts`
- `tests/unit/docs/docs_contract_test.ts`
- `tests/unit/public-api/declarative_dx_test.ts`

Adicionar varredura para garantir que docs/exemplos/testes públicos não usem
mais:

```txt
new Box.App().get
app.get(
app.post(
app.controller(
```

E adicionar teste público garantindo que o low-level não existe em `Box.App`.

## Testes e validação

Rodar narrow tests durante a implementação:

```bash
deno test --allow-read=src tests/unit/public-api/declarative_dx_test.ts tests/unit/public-api/mod_test.ts
deno test --allow-read=src tests/unit/http/openapi_docs_test.ts
deno test --allow-read=src tests/unit/http/controller_decorators_test.ts
deno test --allow-read=examples tests/unit/examples/examples_contract_test.ts
deno test --allow-read=docs,README.md tests/unit/docs/docs_contract_test.ts
```

Rodar gates finais:

```bash
deno task test
deno check src examples bench scripts tests
deno fmt --check
deno lint
deno publish --dry-run --allow-dirty
```

Se o working tree estiver limpo ou as mudanças forem commitadas, também rodar:

```bash
deno publish --dry-run
```

## Riscos e tradeoffs

1. Breaking change real
   - Remover `app.get/post/controller` quebra consumidores existentes.
   - Mitigação: atualizar README/docs/changelog e considerar major/minor com
     aviso claro.

2. Middleware ainda é low-level?
   - `app.use(...)` provavelmente deve continuar público, porque middleware é
     transversal e não substituído por controllers ainda.
   - Se o objetivo for remover todo uso direto de `App`, pode ser necessário
     futuro `createApp({ middlewares: [...] })`.

3. Inferência de `request.body` e `request.query`
   - Não é possível inferir schema Zod de tipos TypeScript apagados em runtime.
   - Manter explícito por enquanto.

4. Inferência de `params`
   - Dá para inferir nomes dos params pelo path, mas não restrições avançadas.
   - `:id` vira string simples; UUID/min/max continuam exigindo schema
     explícito.

5. `HttpStatus` como enum vs const object
   - `enum` atende exatamente ao pedido e é simples para DX.
   - `const object as const` é mais tree-shake-friendly, mas foge da palavra
     “enum”.
   - Recomendação: usar `export enum HttpStatus` agora pela clareza.

## Ordem recomendada

1. Testes RED para ausência da API low-level pública.
2. Criar seam interno de registro e trocar `createApp`.
3. Remover métodos low-level públicos de `App`.
4. Adicionar `HttpStatus` e exports.
5. Implementar defaults de endpoint: `operationId`, `tags`, params básicos.
6. Atualizar testes existentes quebrados.
7. Atualizar docs/exemplos.
8. Rodar gates completos.
