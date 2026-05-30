# Base do Framework REST Serverless/Edge Implementation Plan

> **Para Hermes:** este plano está em modo planejamento. Não implementar nada
> até aprovação explícita.

**Goal:** estabelecer uma base simples para o Box virar um framework de APIs
REST focado em DX simples, Web Standards, Serverless/Edge e cold start mínimo.

**Architecture:** o core deve ser pequeno e sem dependências pesadas no caminho
quente: `Request` entra, `Response` sai. A base deve funcionar em qualquer
runtime compatível com Fetch API/Deno Deploy/Cloudflare Workers/Bun/Node
adapters, evitando decorators, reflection, DI container e inicialização global
custosa. Recursos como logger e validação devem ser opcionais/modulares para não
penalizar cold start de uma API mínima.

**Tech Stack:** Deno + TypeScript, Web Fetch API, testes com `deno test`,
benchmarks simples com `Deno.bench`.

---

## Contexto atual

- Projeto atual: `/home/ander/projects/Box`.
- `deno.json` exporta `./src/mod.ts`.
- Hoje o projeto contém basicamente um módulo de logger em `src/logger/*` e
  exporta `Box.Log` em `src/mod.ts`.
- Existe dependência de `zod`; para cold start, o core HTTP não deve depender
  dela diretamente. Se validação for mantida, deve ficar em módulo opcional.

## Princípios da base

1. Simplicidade acima de abstração: `app.get('/users/:id', handler)` deve ser
   suficiente.
2. Web Standards primeiro: handlers recebem/retornam tipos compatíveis com
   `Request`, `Response`, `URL`, `Headers`.
3. Cold start mínimo: sem decorators, sem metadata reflection, sem class
   scanning, sem container global, sem importar logger/validação no core.
4. Edge/serverless friendly: nenhum uso obrigatório de Node APIs, filesystem ou
   processo global no core.
5. O framework deve ser fácil de testar: criar request fake, chamar
   `app.fetch(request)`, validar `Response`.
6. Erros devem ter default seguro: resposta JSON previsível, sem vazar stack
   trace por padrão.

## API inicial proposta

Exemplo de DX alvo:

```ts
import { Box } from "box";

const app = new Box.App();

app.get("/health", () => Box.json({ ok: true }));

app.get("/users/:id", (ctx) => {
  return Box.json({ id: ctx.params.id });
});

export default app;
```

Para runtimes Fetch-first:

```ts
export default {
  fetch: (request: Request) => app.fetch(request),
};
```

## Plano passo a passo

### 1. Reorganizar exports públicos sem quebrar o logger

**Objetivo:** deixar o core HTTP como caminho principal sem importar logger
automaticamente.

**Arquivos prováveis:**

- Modificar: `src/mod.ts`
- Criar: `src/http/index.ts`
- Criar: `src/http/app.ts`
- Criar: `src/http/types.ts`

**Ações:**

- Exportar `App`, helpers HTTP e tipos a partir de `src/http/index.ts`.
- Manter logger exportável, mas modular, por exemplo
  `export * as Log from "./logger/index.ts"` ou `export { Logger } ...` sem
  acoplar o core.
- Evitar que `new Box.App()` carregue `zod` ou logger.

### 2. Criar o contrato mínimo de handler/context

**Objetivo:** definir o menor conjunto útil para escrever endpoints REST.

**Arquivos prováveis:**

- Criar: `src/http/types.ts`
- Testar: `src/http/types_test.ts` ou cobrir via testes de `app`.

**Contrato sugerido:**

- `Handler = (ctx: Context) => Response | Promise<Response>`
- `Context` com:
  - `request: Request`
  - `url: URL`
  - `params: Record<string, string>`
  - `query: URLSearchParams`
  - `state: Record<string, unknown>` para middlewares simples
- `Middleware = (ctx, next) => Response | Promise<Response>`

**Observação:** manter `Context` como objeto simples, não classe pesada, para
reduzir custo de instanciação.

### 3. Implementar roteador simples por método + path

**Objetivo:** suportar rotas estáticas e parâmetros sem dependências externas.

**Arquivos prováveis:**

- Criar: `src/http/router.ts`
- Criar: `src/http/router_test.ts`

**Escopo inicial:**

- Métodos: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`.
- Paths estáticos: `/health`.
- Params simples: `/users/:id`, `/orders/:orderId/items/:itemId`.
- 404 JSON padrão quando não houver match.
- 405 opcional se path existir mas método não bater; pode ficar para uma segunda
  etapa se complicar.

**Decisão de simplicidade:** começar com compilação de path para regex no
momento do registro da rota. Isso paga custo no boot, mas é pequeno e deixa o
dispatch simples. Depois medir se vale trocar por trie.

### 4. Criar `App` com API fluente e `fetch()`

**Objetivo:** o usuário deve conseguir criar uma API mínima em poucos comandos.

**Arquivos prováveis:**

- Criar: `src/http/app.ts`
- Criar: `src/http/app_test.ts`

**Métodos iniciais:**

- `app.get(path, handler)`
- `app.post(path, handler)`
- `app.put(path, handler)`
- `app.patch(path, handler)`
- `app.delete(path, handler)`
- `app.use(middleware)`
- `app.fetch(request)`

**Comportamento:**

- `app.fetch(request)` deve montar `Context`, executar middlewares e handler, e
  sempre retornar `Response`.
- Se handler lançar erro, delegar para error handler padrão.

### 5. Adicionar helpers pequenos de resposta

**Objetivo:** reduzir boilerplate sem esconder Web Standards.

**Arquivos prováveis:**

- Criar: `src/http/response.ts`
- Criar: `src/http/response_test.ts`

**Helpers iniciais:**

- `json(data, init?)`
- `text(body, init?)`
- `empty(status?)`
- `redirect(url, status?)`

**Regra de cold start:** helpers devem usar APIs nativas (`Response`,
`JSON.stringify`) e não depender de serializers externos.

### 6. Definir erro HTTP simples

**Objetivo:** padronizar falhas sem framework pesado.

**Arquivos prováveis:**

- Criar: `src/http/errors.ts`
- Criar: `src/http/errors_test.ts`

**Escopo inicial:**

- `HttpError` com `status`, `message`, `code?`, `details?`.
- `notFound()` e `badRequest()` como helpers opcionais.
- Error handler padrão retorna JSON:
  - `status`
  - `error`
  - `message`
- Stack trace não deve ir para resposta por padrão.

### 7. Adicionar leitura de body com limite explícito

**Objetivo:** facilitar APIs REST sem abrir risco de payload gigante.

**Arquivos prováveis:**

- Criar: `src/http/body.ts`
- Criar: `src/http/body_test.ts`

**Helpers:**

- `ctx.json<T>()` ou `readJson<T>(request, options)`.
- `ctx.text()` ou `readText(...)`.
- Definir limite padrão simples, por exemplo `1mb`, e permitir override.

**Tradeoff:** se adicionar métodos ao `Context`, ainda manter o objeto leve. Uma
alternativa mais simples é exportar funções `readJson(ctx)`.

### 8. Middlewares mínimos, sem ecossistema prematuro

**Objetivo:** permitir cross-cutting concerns sem criar complexidade agora.

**Arquivos prováveis:**

- Criar: `src/http/middleware.ts`
- Criar: `src/http/middleware_test.ts`

**Escopo inicial:**

- Pipeline `app.use(async (ctx, next) => { ... })`.
- Um helper opcional de `cors()` pode ser criado só se necessário para validação
  manual.
- Não criar autenticação, DI, OpenAPI, ORM, plugins ou decorators nesta fase.

### 9. Adapters de runtime: começar Fetch-first

**Objetivo:** manter o core portável e adicionar adapters só onde agregam.

**Arquivos prováveis:**

- Criar: `src/adapters/deno.ts`
- Opcional futuro: `src/adapters/node.ts`, `src/adapters/cloudflare.ts`

**Primeira etapa:**

- `app.fetch(request)` já cobre Deno Deploy, Cloudflare Workers e vários
  runtimes Edge.
- Adapter Deno pode ser apenas um helper `serve(app, options?)` usando
  `Deno.serve`.

**Não fazer agora:** criar adapter Node completo antes de validar necessidade
real.

### 10. Criar exemplo mínimo e documentação inicial

**Objetivo:** deixar claro que o framework é simples.

**Arquivos prováveis:**

- Criar: `examples/hello-world/main.ts`
- Criar: `examples/rest-api/main.ts`
- Modificar: `README.md`

**README deve conter:**

- Instalação/uso básico.
- Exemplo `GET /health`.
- Exemplo de params e query.
- Exemplo de middleware simples.
- Nota explícita: core baseado em Fetch API e pensado para Serverless/Edge.

### 11. Adicionar testes e checks como contrato de base

**Objetivo:** travar comportamento antes de expandir features.

**Arquivos prováveis:**

- Modificar: `deno.json`
- Criar testes ao lado dos módulos: `src/http/*_test.ts`

**Tasks sugeridas em `deno.json`:**

- `test`: `deno test --allow-none`
- `check`: `deno check src/mod.ts`
- `fmt`: `deno fmt`
- `lint`: `deno lint`
- `bench`: `deno bench`

**Validação esperada:**

- `deno fmt --check`
- `deno lint`
- `deno check src/mod.ts`
- `deno test --allow-none`

### 12. Medir cold start e overhead mínimo

**Objetivo:** tomar decisões com métrica, não feeling.

**Arquivos prováveis:**

- Criar: `bench/router_bench.ts`
- Criar: `bench/cold_start_bench.ts` ou script simples em
  `scripts/measure_startup.ts`

**Métricas iniciais:**

- Tempo para importar `src/mod.ts`.
- Tempo para criar `new App()` com 1 rota.
- Latência média de `app.fetch(new Request(...))` para rota estática.
- Latência média para rota com params.
- Tamanho/quantidade de módulos carregados, se viável medir no Deno.

**Meta inicial sugerida:**

- API hello-world deve iniciar sem carregar logger/zod.
- Dispatch de rota simples deve ficar em micro/milisegundos baixos em benchmark
  local.
- Nenhum acesso a filesystem/rede/env durante import do core.

## Arquivos provavelmente alterados/criados

- `deno.json`
- `README.md`
- `src/mod.ts`
- `src/http/index.ts`
- `src/http/types.ts`
- `src/http/app.ts`
- `src/http/router.ts`
- `src/http/response.ts`
- `src/http/errors.ts`
- `src/http/body.ts`
- `src/http/middleware.ts`
- `src/http/*_test.ts`
- `src/adapters/deno.ts`
- `examples/hello-world/main.ts`
- `examples/rest-api/main.ts`
- `bench/router_bench.ts`
- `bench/cold_start_bench.ts` ou `scripts/measure_startup.ts`

## O que evitar na primeira base

- Decorators e reflection.
- Auto-discovery de controllers por filesystem.
- DI container.
- OpenAPI automático.
- Validação obrigatória com Zod no core.
- ORM/database abstractions.
- Plugins antes do contrato do core estabilizar.
- Adapter Node completo antes de confirmar necessidade.

## Testes / validação

Executar após implementação:

```bash
deno fmt --check
deno lint
deno check src/mod.ts
deno test --allow-none
deno bench
```

Smoke test manual esperado:

```ts
const app = new Box.App();
app.get("/health", () => Box.json({ ok: true }));
const res = await app.fetch(new Request("http://localhost/health"));
// status 200, body { ok: true }
```

Verificações específicas de cold start:

- Importar `src/mod.ts` não deve executar side effects.
- `new App()` não deve carregar logger nem zod.
- Registrar rotas deve compilar paths uma vez.
- Cada request deve alocar apenas `URL`, `Context` simples e o mínimo necessário
  para match.

## Riscos e tradeoffs

- Regex por rota é simples, mas pode ficar menos eficiente com muitas rotas.
  Aceitar agora; medir antes de trocar por trie.
- Zod é útil para DX, mas deve ser opcional para não prejudicar APIs mínimas em
  Edge.
- Um `Context` muito rico melhora ergonomia, mas aumenta custo por request.
  Começar pequeno.
- Manter compatibilidade entre Deno, Cloudflare, Bun e Node pode puxar o design
  para baixo denominador comum. Priorizar Fetch API no core e adapters
  separados.

## Open questions

1. O primeiro runtime alvo oficial será Deno Deploy, Cloudflare Workers, AWS
   Lambda Edge, Bun ou Node serverless?
2. O pacote deve continuar sendo Deno/JSR-first ou também precisa publicar para
   npm desde o início?
3. A validação com Zod deve virar módulo opcional oficial (`box/zod`) ou ficar
   fora da primeira versão?
4. O logger atual deve permanecer dentro do pacote principal ou virar submódulo
   separado para preservar cold start do core?

## Sugestão de primeira milestone

Implementar apenas isto primeiro:

1. `App` + `app.fetch()`.
2. Rotas `GET/POST` com params.
3. `Box.json()`.
4. 404 e erro padrão.
5. Testes de rota, params, query e erro.
6. README com hello-world.
7. Benchmark básico de import/criação/dispatch.

Depois dessa base passar nos testes e benchmarks, expandir
middleware/body/adapters conforme necessidade real.
