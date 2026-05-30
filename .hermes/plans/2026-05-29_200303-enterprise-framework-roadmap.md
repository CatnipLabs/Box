# BOX Enterprise REST Framework Roadmap

> **For Hermes:** evoluir em fatias verticais com TDD, preservando cold start.
> Nada de decorators/reflection/auto-scan no core quente.

**Goal:** levar o Box de um core HTTP mínimo para um framework REST enterprise,
serverless-first, com DX similar a NestJS/C# sem perder performance de cold
start.

**Architecture:** core pequeno baseado em Web Fetch API; módulos opcionais para
DDD, OpenAPI/Scalar, segurança, ORM Deno KV, logging e testes/performance.
Classes base definem contratos; registro explícito evita filesystem scan e
reflection.

**Tech Stack:** Deno + TypeScript, Fetch API, Deno KV adapter opcional, OpenAPI
3.1 + Scalar UI opcional, `deno test`/coverage/bench.

---

## Milestone 1 — Application model / DDD foundation

1. Criar contratos base: `Entity`, `Repository<TEntity>`, `Service`,
   `Controller`.
2. Adicionar `app.controller(controller)` para registrar rotas de controllers de
   forma explícita.
3. Garantir que `Repository` só aceite entidade que estende `Entity`.
4. Exportar como `box/core` e também em `Box.*`.
5. Documentar padrão controller/service/repository no README.
6. Gates: `deno fmt --check`, `deno lint`, `deno check src/mod.ts`, `deno test`.

## Milestone 2 — Error contract e custom exceptions

1. Expandir `HttpError` para contrato universal: `statusCode`, `code`,
   `message`, `details`, `path`, `requestId`, `timestamp`.
2. Criar `Exception`/custom exceptions base com helpers por status.
3. Criar error handler configurável sem vazar stack.
4. Garantir tests para erro esperado, inesperado, validation-like e custom
   exception.

## Milestone 3 — Segurança nativa

1. Middlewares opcionais `cors()` e `secureHeaders()` estilo Helmet.
2. Defaults seguros: `x-content-type-options`, `x-frame-options`,
   `referrer-policy`, `content-security-policy` configurável.
3. Suporte a preflight CORS e allowlist por origem/método/header.
4. Bench de overhead de middleware.

## Milestone 4 — Logger enterprise

1. Logger estruturado com levels, context/requestId, child logger e serializers
   seguros.
2. Middleware de access log com duração, status, path, method e erro.
3. No core hot path, logger continua opcional/importado sob demanda.

## Milestone 5 — ORM / Deno KV abstraction

1. `KvEntity`, `KvRepository`, query builder tipado e índices declarativos.
2. CRUD simples sem query manual.
3. Filtros compostos, paginação, ordenação, prefix/range queries e transações
   atômicas quando suportadas pelo KV.
4. Documentar limites reais do Deno KV: queries complexas dependem de
   índices/materialização; não prometer joins arbitrários sem custo.

## Milestone 6 — Auto documentation OpenAPI + Scalar

1. Metadata explícita por rota/controller/DTO sem reflection pesada.
2. Gerador OpenAPI 3.1 a partir de controllers, DTO schemas e errors.
3. Rota `/docs` com Scalar UI e `/openapi.json`.
4. Módulo opcional para não penalizar cold start de APIs sem docs.

## Milestone 7 — Testing, coverage e performance

1. Configurar coverage gate para 100% unitário e integração.
2. Criar testes integrados com apps exemplo reais.
3. Scripts de carga/cold start com thresholds explícitos.
4. CI documentado para fmt/lint/check/test/coverage/bench.

## Milestone 8 — Open source readiness

1. README completo, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, CHANGELOG.
2. Exemplos: hello-world, CRUD DDD, KV repository, auth/security, docs Scalar.
3. Publicação JSR/npm se necessário.
4. Templates de issue/PR e guia de versionamento.

## Primeira fatia a implementar agora

Implementar Milestone 1 em TDD:

- Teste RED para `app.controller(new UsersController(...))` registrando rotas
  com prefixo.
- Teste RED para `Repository` exigindo `Entity` base.
- Implementar `src/core/*` e integração em `src/http/app.ts`.
- Atualizar exports e README.
- Rodar todos os gates reais.
