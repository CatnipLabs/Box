# REST Serverless/Edge Framework Base Implementation Plan

> **For Hermes:** this plan is in planning mode. Do not implement anything until
> explicit approval.

**Goal:** establish a simple foundation for Box to become a REST API framework
focused on simple DX, Web Standards, Serverless/Edge, and minimal cold start.

**Architecture:** the core should be small and free of heavy dependencies in the
hot path: `Request` in, `Response` out. The base should work in any runtime
compatible with the Fetch API/Deno Deploy/Cloudflare Workers/Bun/Node adapters,
avoiding decorators, reflection, DI containers, and costly global
initialization. Features such as logging and validation should be
optional/modular so they do not penalize the cold start of a minimal API.

**Tech Stack:** Deno + TypeScript, Web Fetch API, tests with `deno test`, simple
benchmarks with `Deno.bench`.

---

## Current context

- Current project: `/home/ander/projects/Box`.
- `deno.json` exports `./src/mod.ts`.
- Today the project basically contains a logger module in `src/logger/*` and
  exports `Box.Log` in `src/mod.ts`.
- There is a dependency on `zod`; for cold start, the HTTP core should not
  depend on it directly. If validation is kept, it should stay in an optional
  module.

## Foundation principles

1. Simplicity over abstraction: `app.get('/users/:id', handler)` should be
   enough.
2. Web Standards first: handlers receive/return types compatible with `Request`,
   `Response`, `URL`, `Headers`.
3. Minimal cold start: no decorators, no metadata reflection, no class scanning,
   no global container, no importing logger/validation in the core.
4. Edge/serverless friendly: no mandatory use of Node APIs, filesystem, or
   global process in the core.
5. The framework should be easy to test: create a fake request, call
   `app.fetch(request)`, validate `Response`.
6. Errors should have a safe default: predictable JSON response, without leaking
   stack trace by default.

## Proposed initial API

Target DX example:

```ts
import { Box } from "box";

const app = new Box.App();

app.get("/health", () => Box.json({ ok: true }));

app.get("/users/:id", (ctx) => {
  return Box.json({ id: ctx.params.id });
});

export default app;
```

For Fetch-first runtimes:

```ts
export default {
  fetch: (request: Request) => app.fetch(request),
};
```

## Step-by-step plan

### 1. Reorganize public exports without breaking the logger

**Objective:** make the HTTP core the main path without importing the logger
automatically.

**Likely files:**

- Modify: `src/mod.ts`
- Create: `src/http/index.ts`
- Create: `src/http/app.ts`
- Create: `src/http/types.ts`

**Actions:**

- Export `App`, HTTP helpers, and types from `src/http/index.ts`.
- Keep the logger exportable, but modular, for example
  `export * as Log from "./logger/index.ts"` or `export { Logger } ...` without
  coupling the core.
- Avoid having `new Box.App()` load `zod` or the logger.

### 2. Create the minimal handler/context contract

**Objective:** define the smallest useful set for writing REST endpoints.

**Likely files:**

- Create: `src/http/types.ts`
- Test: `src/http/types_test.ts` or cover through `app` tests.

**Suggested contract:**

- `Handler = (ctx: Context) => Response | Promise<Response>`
- `Context` with:
  - `request: Request`
  - `url: URL`
  - `params: Record<string, string>`
  - `query: URLSearchParams`
  - `state: Record<string, unknown>` for simple middlewares
- `Middleware = (ctx, next) => Response | Promise<Response>`

**Note:** keep `Context` as a simple object, not a heavy class, to reduce
instantiation cost.

### 3. Implement a simple router by method + path

**Objective:** support static routes and parameters without external
dependencies.

**Likely files:**

- Create: `src/http/router.ts`
- Create: `src/http/router_test.ts`

**Initial scope:**

- Methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`.
- Static paths: `/health`.
- Simple params: `/users/:id`, `/orders/:orderId/items/:itemId`.
- Default JSON 404 when there is no match.
- Optional 405 if the path exists but the method does not match; this can be
  left for a second stage if it becomes complicated.

**Simplicity decision:** start with path compilation to regex at route
registration time. This pays a cost at boot, but it is small and keeps the
dispatch simple. Later measure whether it is worth switching to a trie.

### 4. Create `App` with fluent API and `fetch()`

**Objective:** the user should be able to create a minimal API in a few
commands.

**Likely files:**

- Create: `src/http/app.ts`
- Create: `src/http/app_test.ts`

**Initial methods:**

- `app.get(path, handler)`
- `app.post(path, handler)`
- `app.put(path, handler)`
- `app.patch(path, handler)`
- `app.delete(path, handler)`
- `app.use(middleware)`
- `app.fetch(request)`

**Behavior:**

- `app.fetch(request)` should build `Context`, run middlewares and the handler,
  and always return `Response`.
- If the handler throws an error, delegate to the default error handler.

### 5. Add small response helpers

**Objective:** reduce boilerplate without hiding Web Standards.

**Likely files:**

- Create: `src/http/response.ts`
- Create: `src/http/response_test.ts`

**Initial helpers:**

- `json(data, init?)`
- `text(body, init?)`
- `empty(status?)`
- `redirect(url, status?)`

**Cold start rule:** helpers should use native APIs (`Response`,
`JSON.stringify`) and not depend on external serializers.

### 6. Define a simple HTTP error

**Objective:** standardize failures without a heavy framework.

**Likely files:**

- Create: `src/http/errors.ts`
- Create: `src/http/errors_test.ts`

**Initial scope:**

- `HttpError` with `status`, `message`, `code?`, `details?`.
- `notFound()` and `badRequest()` as optional helpers.
- Default error handler returns JSON:
  - `status`
  - `error`
  - `message`
- Stack trace should not go into the response by default.

### 7. Add body reading with an explicit limit

**Objective:** make REST APIs easier without opening the risk of a huge payload.

**Likely files:**

- Create: `src/http/body.ts`
- Create: `src/http/body_test.ts`

**Helpers:**

- `ctx.json<T>()` or `readJson<T>(request, options)`.
- `ctx.text()` or `readText(...)`.
- Define a simple default limit, for example `1mb`, and allow override.

**Tradeoff:** if adding methods to `Context`, still keep the object lightweight.
A simpler alternative is to export `readJson(ctx)` functions.

### 8. Minimal middlewares, without a premature ecosystem

**Objective:** allow cross-cutting concerns without creating complexity now.

**Likely files:**

- Create: `src/http/middleware.ts`
- Create: `src/http/middleware_test.ts`

**Initial scope:**

- Pipeline `app.use(async (ctx, next) => { ... })`.
- An optional `cors()` helper can be created only if needed for manual
  validation.
- Do not create authentication, DI, OpenAPI, ORM, plugins, or decorators in this
  phase.

### 9. Runtime adapters: start Fetch-first

**Objective:** keep the core portable and add adapters only where they add
value.

**Likely files:**

- Create: `src/adapters/deno.ts`
- Future optional: `src/adapters/node.ts`, `src/adapters/cloudflare.ts`

**First stage:**

- `app.fetch(request)` already covers Deno Deploy, Cloudflare Workers, and
  several Edge runtimes.
- Deno adapter can be just a `serve(app, options?)` helper using `Deno.serve`.

**Do not do now:** create a complete Node adapter before validating real need.

### 10. Create a minimal example and initial documentation

**Objective:** make it clear that the framework is simple.

**Likely files:**

- Create: `examples/hello-world/main.ts`
- Create: `examples/rest-api/main.ts`
- Modify: `README.md`

**README should contain:**

- Installation/basic usage.
- `GET /health` example.
- Params and query example.
- Simple middleware example.
- Explicit note: core based on Fetch API and designed for Serverless/Edge.

### 11. Add tests and checks as the foundation contract

**Objective:** lock behavior before expanding features.

**Likely files:**

- Modify: `deno.json`
- Create tests next to the modules: `src/http/*_test.ts`

**Suggested tasks in `deno.json`:**

- `test`: `deno test --allow-none`
- `check`: `deno check src/mod.ts`
- `fmt`: `deno fmt`
- `lint`: `deno lint`
- `bench`: `deno bench`

**Expected validation:**

- `deno fmt --check`
- `deno lint`
- `deno check src/mod.ts`
- `deno test --allow-none`

### 12. Measure cold start and minimal overhead

**Objective:** make decisions with metrics, not gut feeling.

**Likely files:**

- Create: `bench/router_bench.ts`
- Create: `bench/cold_start_bench.ts` or a simple script in
  `scripts/measure_startup.ts`

**Initial metrics:**

- Time to import `src/mod.ts`.
- Time to create `new App()` with 1 route.
- Average latency of `app.fetch(new Request(...))` for a static route.
- Average latency for a route with params.
- Size/number of loaded modules, if feasible to measure in Deno.

**Suggested initial target:**

- Hello-world API should start without loading logger/zod.
- Simple route dispatch should stay in low microseconds/milliseconds in local
  benchmark.
- No filesystem/network/env access during core import.

## Files likely changed/created

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
- `bench/cold_start_bench.ts` or `scripts/measure_startup.ts`

## What to avoid in the first base

- Decorators and reflection.
- Auto-discovery of controllers by filesystem.
- DI container.
- Automatic OpenAPI.
- Mandatory validation with Zod in the core.
- ORM/database abstractions.
- Plugins before the core contract stabilizes.
- Complete Node adapter before confirming need.

## Tests / validation

Run after implementation:

```bash
deno fmt --check
deno lint
deno check src/mod.ts
deno test --allow-none
deno bench
```

Expected manual smoke test:

```ts
const app = new Box.App();
app.get("/health", () => Box.json({ ok: true }));
const res = await app.fetch(new Request("http://localhost/health"));
// status 200, body { ok: true }
```

Specific cold start checks:

- Importing `src/mod.ts` should not execute side effects.
- `new App()` should not load logger or zod.
- Registering routes should compile paths once.
- Each request should allocate only `URL`, simple `Context`, and the minimum
  necessary for matching.

## Risks and tradeoffs

- Regex per route is simple, but can become less efficient with many routes.
  Accept for now; measure before switching to a trie.
- Zod is useful for DX, but should be optional to avoid hurting minimal APIs on
  Edge.
- A very rich `Context` improves ergonomics, but increases cost per request.
  Start small.
- Maintaining compatibility among Deno, Cloudflare, Bun, and Node can pull the
  design toward the lowest common denominator. Prioritize Fetch API in the core
  and separate adapters.

## Open questions

1. Will the first official target runtime be Deno Deploy, Cloudflare Workers,
   AWS Lambda Edge, Bun, or Node serverless?
2. Should the package remain Deno/JSR-first, or does it also need to publish to
   npm from the beginning?
3. Should validation with Zod become an official optional module (`box/zod`) or
   stay out of the first version?
4. Should the current logger remain inside the main package or become a separate
   submodule to preserve the core cold start?

## Suggested first milestone

Implement only this first:

1. `App` + `app.fetch()`.
2. `GET/POST` routes with params.
3. `Box.json()`.
4. 404 and default error.
5. Tests for route, params, query, and error.
6. README with hello-world.
7. Basic benchmark for import/creation/dispatch.

After this base passes the tests and benchmarks, expand middleware/body/adapters
according to real need.
