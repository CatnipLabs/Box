# BOX Enterprise REST Framework Roadmap

> **For Hermes:** evolve in vertical slices with TDD, preserving cold start. No
> decorators/reflection/auto-scan in the hot core.

**Goal:** take Box from a minimal HTTP core to an enterprise REST framework,
serverless-first, with DX similar to NestJS/C# without losing cold start
performance.

**Architecture:** small core based on the Web Fetch API; optional modules for
DDD, OpenAPI/Scalar, security, Deno KV ORM, logging, and testing/performance.
Base classes define contracts; explicit registration avoids filesystem scan and
reflection.

**Tech Stack:** Deno + TypeScript, Fetch API, optional Deno KV adapter, optional
OpenAPI 3.1 + Scalar UI, `deno test`/coverage/bench.

---

## Milestone 1 — Application model / DDD foundation

1. Create base contracts: `Entity`, `Repository<TEntity>`, `Service`,
   `Controller`.
2. Add `app.controller(controller)` to register controller routes explicitly.
3. Ensure that `Repository` only accepts an entity that extends `Entity`.
4. Export as `box/core` and also in `Box.*`.
5. Document the controller/service/repository pattern in the README.
6. Gates: `deno fmt --check`, `deno lint`, `deno check src/mod.ts`, `deno test`.

## Milestone 2 — Error contract and custom exceptions

1. Expand `HttpError` to a universal contract: `statusCode`, `code`, `message`,
   `details`, `path`, `requestId`, `timestamp`.
2. Create base `Exception`/custom exceptions with helpers by status.
3. Create a configurable error handler without leaking the stack.
4. Ensure tests for expected error, unexpected error, validation-like error, and
   custom exception.

## Milestone 3 — Native security

1. Optional `cors()` and `secureHeaders()` middlewares in Helmet style.
2. Secure defaults: `x-content-type-options`, `x-frame-options`,
   `referrer-policy`, configurable `content-security-policy`.
3. Support CORS preflight and allowlist by origin/method/header.
4. Benchmark middleware overhead.

## Milestone 4 — Enterprise logger

1. Structured logger with levels, context/requestId, child logger, and safe
   serializers.
2. Access log middleware with duration, status, path, method, and error.
3. In the core hot path, the logger remains optional/imported on demand.

## Milestone 5 — ORM / Deno KV abstraction

1. `KvEntity`, `KvRepository`, typed query builder, and declarative indexes.
2. Simple CRUD without manual query.
3. Composite filters, pagination, sorting, prefix/range queries, and atomic
   transactions when supported by KV.
4. Document the real limits of Deno KV: complex queries depend on
   indexes/materialization; do not promise arbitrary joins without cost.

## Milestone 6 — Auto documentation OpenAPI + Scalar

1. Explicit metadata by route/controller/DTO without heavy reflection.
2. OpenAPI 3.1 generator from controllers, DTO schemas, and errors.
3. `/docs` route with Scalar UI and `/openapi.json`.
4. Optional module to avoid penalizing the cold start of APIs without docs.

## Milestone 7 — Testing, coverage, and performance

1. Configure coverage gate for 100% unit and integration coverage.
2. Create integrated tests with real example apps.
3. Load/cold start scripts with explicit thresholds.
4. Documented CI for fmt/lint/check/test/coverage/bench.

## Milestone 8 — Open source readiness

1. Complete README, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, CHANGELOG.
2. Examples: hello-world, CRUD DDD, KV repository, auth/security, Scalar docs.
3. JSR/npm publishing if necessary.
4. Issue/PR templates and versioning guide.

## First slice to implement now

Implement Milestone 1 with TDD:

- RED test for `app.controller(new UsersController(...))` registering routes
  with prefix.
- RED test for `Repository` requiring the base `Entity`.
- Implement `src/core/*` and integration in `src/http/app.ts`.
- Update exports and README.
- Run all real gates.
