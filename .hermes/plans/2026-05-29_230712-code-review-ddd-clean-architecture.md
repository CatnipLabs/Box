# BOX code review and DDD/Clean Architecture reorganization plan

## Objective

Review the entire BOX framework codebase with a focus on:

- DDD / Clean Architecture organization.
- SOLID and Clean Code.
- Single Responsibility Principle: avoid files with multiple public
  classes/interfaces without a clear responsibility.
- Separating tests from implementations.
- Reducing "flat" folders with many loose files by using responsibility-based
  subfolders.
- Preserving cold start/serverless behavior and public API compatibility.
- Maintaining or improving the current test, coverage, bench, and startup gates.

This plan is planning-only. No implementation was done in this turn.

## Observed context

Current branch: `main`.

There are pending uncommitted changes related to previous stages:

- DDD core: `src/core/`
- HTTP app/errors/security
- Structured logger and request logger
- Initial KV ORM
- README and exports

Known gates from the last round:

- `deno task test`: 68 passed / 0 failed
- Global coverage: Branch 91.3%, Function 87.4%, Line 88.8%
- `src/orm/kv_repository.ts`: 100% branch/function/line
- Approximate current bench:
  - Create app: ~376 ns
  - Static GET: ~4.7 µs
  - Param GET: ~4.7 µs
- Approximate cold start:
  - importMs ~1.18 ms
  - createAndRegisterMs ~0.17 ms
  - firstRequestMs ~0.41 ms

## Main code review findings

### 1. Tests are colocated with implementation

Today there are tests under `src/**`:

- `src/core/core_test.ts`
- `src/http/app_test.ts`
- `src/http/response_test.ts`
- `src/http/security_test.ts`
- `src/logger/index_test.ts`
- `src/mod_test.ts`
- `src/orm/kv_repository_test.ts`

Problem:

- It mixes production code and validation.
- It makes the published package harder to read.
- It does not scale well for unit, integration, performance tests, and fixtures.

Proposal:

```text
tests/
  unit/
    core/
    http/
    logger/
    orm/
    public-api/
  integration/
    http/
    orm/
  performance/
  fixtures/
```

### 2. Files with multiple clear responsibilities

Files that should be split first:

#### `src/orm/kv_repository.ts`

Today it concentrates:

- Key/id/entry types.
- `KvStore` interface.
- `KvEntityMapper` interface.
- `KvRepositoryOptions` interface.
- `KvRepository` class.
- `KvQueryBuilder` class.
- Query/sort/filter types.
- Comparison/filter helpers.

Problem: broken SRP. This is the most obvious file to refactor.

#### `src/logger/index.ts`

Today it concentrates:

- `Logger` class.
- `RequestLoggerOptions` interface.
- `requestLogger` middleware.
- Request id, duration, error, and serialization helpers.
- Reexports.

Problem: core logger and HTTP middleware are different responsibilities.

#### `src/http/security.ts`

Today it concentrates:

- CORS.
- Helmet-style secure headers.
- CORS types.
- Secure headers types.
- Origin/header/vary helpers.

Problem: CORS and secure headers are independent middlewares.

#### `src/http/app.ts`

Today it concentrates:

- `App` class.
- Context creation.
- CORS preflight detection.
- Universal error response assembly.
- Controller path joining.

Problem: `App` should orchestrate, not contain factories/formatters/guards.

#### `src/http/errors.ts`

Today it concentrates:

- `HttpErrorOptions` interface not used directly by the current constructor.
- `HttpError` class.
- `notFound`, `methodNotAllowed`, `badRequest`, `payloadTooLarge` factories.
- `defaultCode`.

Problem: it mixes the base exception, factories, and code mapping policy.

#### `src/logger/logger-constructor.schema.ts`

Today it concentrates:

- Log record/sink/clock/options types.
- Manual parser/schema.
- Internal validation helpers.

Problem: contracts and validation are together.

### 3. Folders are too simple for the current framework size

Current example:

```text
src/http/
  app.ts
  body.ts
  errors.ts
  index.ts
  middleware.ts
  response.ts
  router.ts
  security.ts
  types.ts
```

The problem is not having many files, but having many files without
bounded-context/responsibility grouping.

Proposal: small cohesive subfolders, with a barrel `index.ts` at each boundary.

### 4. Names and compatibility require care

- `getFormatedName`, `getFormatedLevel`, and `getFormatedTime` have a typo in
  "Formated".
- Because they are already public methods, directly fixing them would be a
  breaking change.
- Better strategy: add the correct `getFormatted*` names and keep the old
  aliases marked as deprecated for one version.

### 5. The current ORM is good as a first slice, but not enterprise yet

Positive points:

- `KvRepository` depends on `KvStore`, not directly on `Deno.Kv`.
- This preserves DIP and makes testing easier.
- It requires `Entity`, aligned with the requested DDD direction.

Points to evolve:

- The current query scans by collection prefix and filters in memory.
- For enterprise usage, Deno KV needs indexes/materialized access patterns.
- Query builder and repository should be separated before adding indexes;
  otherwise the file will become even more coupled.

### 6. Security: points to review after reorganization

- `cors({ origin: "*", credentials: true })` should be blocked or normalized,
  because browsers do not accept wildcard origins with credentials.
- `secureHeaders` still does not cover some common headers, such as HSTS,
  Permissions-Policy, and X-Permitted-Cross-Domain-Policies.
- Default CSP is `false`, acceptable for an API, but it should be documented as
  an intentional choice.
- Unexpected errors do not leak stack traces, which is a positive point.

### 7. Coverage is still not at the desired final standard

Files with low or partial coverage:

- `core/controller.ts`: line ~55.9%, function ~50.0%
- `http/app.ts`: line ~82.7%, function ~63.2%
- `http/body.ts`: line ~76.9%, branch ~62.5%
- `http/errors.ts`: line ~55.3%, branch ~50.0%
- `http/router.ts`: line ~87.1%, branch ~81.8%
- `http/security.ts`: line ~82.6%, branch ~83.7%

Before major new features, I recommend solving organization + coverage to create
a clean foundation.

## Proposed target architecture

### High-level structure

```text
src/
  core/
    domain/
      entity.ts
      entity-constructor.type.ts
      repository.base.ts
    application/
      service.base.ts
    presentation/
      controller.base.ts
      route-definition.interface.ts
    index.ts

  http/
    application/
      app.ts
      app-context.factory.ts
      controller-path.util.ts
    domain/
      errors/
        http-error.exception.ts
        http-error-code.util.ts
        bad-request.factory.ts
        not-found.factory.ts
        method-not-allowed.factory.ts
        payload-too-large.factory.ts
      response/
        error-response.factory.ts
    presentation/
      body/
        read-json.ts
        read-text.ts
        body-read-options.interface.ts
      response/
        json.response.ts
        text.response.ts
        empty.response.ts
        redirect.response.ts
      router/
        router.ts
        route-match.interface.ts
        router-miss.interface.ts
        path-normalizer.util.ts
        path-compiler.util.ts
      middleware/
        compose.ts
        middleware.type.ts
        context.interface.ts
        handler.type.ts
    security/
      cors/
        cors.middleware.ts
        cors-options.interface.ts
        cors-origin.type.ts
        cors-origin.resolver.ts
        cors-allowed-headers.util.ts
        append-vary.util.ts
        cors-preflight.guard.ts
      secure-headers/
        secure-headers.middleware.ts
        secure-headers-options.interface.ts
        secure-headers-defaults.ts
    index.ts

  logger/
    domain/
      levels.enum.ts
      log-context.type.ts
      log-record.interface.ts
      log-sink.type.ts
      logger-clock.type.ts
    application/
      logger.ts
      logger-options.interface.ts
      logger-options.schema.ts
      message-to-text.util.ts
    presentation/
      colors/
        background-colors.enum.ts
        foreground-colors.enum.ts
      formatters/
        format-log-line.ts
        format-log-level.ts
        format-log-name.ts
        format-log-time.ts
    infrastructure/
      http/
        request-logger.middleware.ts
        request-logger-options.interface.ts
        request-id-context.util.ts
        error-summary.util.ts
    index.ts

  orm/
    kv/
      domain/
        kv-key.type.ts
        kv-entry.interface.ts
        kv-store.interface.ts
        kv-entity-mapper.interface.ts
        kv-repository-options.interface.ts
      application/
        kv-repository.ts
        kv-query-builder.ts
      query/
        query-filter.interface.ts
        query-sort.interface.ts
        query-operator.type.ts
        sort-direction.type.ts
        entity-field.type.ts
        matches-filter.util.ts
        contains-value.util.ts
        compare-values.util.ts
      mapping/
        default-kv-entity-mapper.ts
      index.ts
    index.ts

  adapters/
    deno/
      serve.ts
      index.ts

  mod.ts
```

### Architectural rules

1. `domain/` does not import `Request`, `Response`, `Deno`, `performance`,
   `console`, or runtime APIs.
2. `application/` orchestrates use cases and may depend on domain contracts.
3. `presentation/` handles HTTP, response format, router, and middleware.
4. `infrastructure/` contains external/runtime-specific adaptations.
5. `mod.ts` and `*/index.ts` are public barrels; they should not contain
   business rules.
6. A file should have at most one main public class.
7. Interfaces/types may remain grouped only when they are small and inseparable
   contracts; otherwise, split them into `.interface.ts`, `.type.ts`, or
   `.util.ts`.
8. A refactor must not change behavior or public API without a test and
   deprecation path.

## Recommended execution plan

### Phase 0 — Freeze baseline and protect behavior

Objective: refactor without breaking behavior.

Steps:

1. Create a dedicated branch, for example:
   - `refactor/ddd-clean-architecture-organization`
2. Record the current baseline:
   - `deno task fmt`
   - `deno fmt --check`
   - `deno lint`
   - `deno task check`
   - `deno task test`
   - `deno check src/mod.ts src/core/index.ts src/http/index.ts src/logger/index.ts src/orm/index.ts examples/rest-api/main.ts examples/hello-world/main.ts bench/router_bench.ts scripts/measure_startup.ts`
   - `rm -rf coverage && deno test --coverage=coverage && deno coverage coverage`
   - `deno task bench`
   - `deno run scripts/measure_startup.ts`
3. Do not accept a performance/cold start regression above normal noise without
   justification.
4. Do not add features in this phase; only organization/refactor.

### Phase 1 — Move tests out of `src`

Objective: separate production and tests without changing behavior.

Suggested moves:

```text
src/core/core_test.ts              -> tests/unit/core/core_test.ts
src/http/app_test.ts               -> tests/unit/http/app_test.ts
src/http/response_test.ts          -> tests/unit/http/response_test.ts
src/http/security_test.ts          -> tests/unit/http/security_test.ts
src/logger/index_test.ts           -> tests/unit/logger/logger_test.ts
src/mod_test.ts                    -> tests/unit/public-api/mod_test.ts
src/orm/kv_repository_test.ts      -> tests/unit/orm/kv/kv_repository_test.ts
```

Adjustments:

- Fix relative imports.
- Create `tests/fixtures/` for fake classes such as `User`, `MemoryKv`, test
  controllers, etc.
- Update `deno.json` with tasks:
  - `test`: `deno test tests`
  - `test:unit`: `deno test tests/unit`
  - `test:integration`: `deno test tests/integration`
  - `coverage`:
    `rm -rf coverage && deno test --coverage=coverage tests && deno coverage coverage`

Validation:

- Run only the moved tests.
- Then run the complete suite.

### Phase 2 — Reorganize `core`

Objective: keep the DDD bases clean.

Likely files:

```text
src/core/domain/entity.ts
src/core/domain/entity-constructor.type.ts
src/core/domain/repository.base.ts
src/core/application/service.base.ts
src/core/presentation/controller.base.ts
src/core/presentation/route-definition.interface.ts
src/core/index.ts
```

Care points:

- Keep public exports `Entity`, `Repository`, `Service`, `Controller`,
  `RouteDefinition`.
- Update internal imports without changing the public API.
- Controller/repository tests must keep passing.

### Phase 3 — Reorganize HTTP

Objective: separate App, router, middleware, responses, body, and errors.

Recommended order:

1. Extract factories/utils from `src/http/app.ts`:
   - `app-context.factory.ts`
   - `error-response.factory.ts`
   - `controller-path.util.ts`
   - `cors-preflight.guard.ts`
2. Reorganize errors:
   - `http-error.exception.ts`
   - `http-error-code.util.ts`
   - specific factories.
3. Reorganize router:
   - `router.ts`
   - match/miss interfaces.
   - path/regex utils.
4. Reorganize body/response/middleware into subfolders.
5. Update `src/http/index.ts` while keeping the current exports.

Care points:

- Do not break the universal error contract.
- Do not change status/body in current tests.
- Preserve CORS preflight before the router.
- Ensure `allow` on 405 keeps working.

### Phase 4 — Reorganize security

Objective: separate CORS and secure headers.

Structure:

```text
src/http/security/cors/
src/http/security/secure-headers/
```

Planned improvements, but as separate TDD steps:

1. RED test for `cors({ origin: "*", credentials: true })`.
2. Decide behavior:
   - throw a configuration error; or
   - reflect origin when credentials=true.
3. Add modern optional headers in `secureHeaders`:
   - `strict-transport-security`
   - `permissions-policy`
   - `x-permitted-cross-domain-policies`
4. Document defaults.

### Phase 5 — Reorganize logger

Objective: separate the core logger from HTTP middleware and visual formatting.

Structure:

```text
src/logger/domain/
src/logger/application/
src/logger/presentation/
src/logger/infrastructure/http/
```

Recommended changes:

- `Logger` stays in `application/logger.ts`.
- `requestLogger` stays in `infrastructure/http/request-logger.middleware.ts`.
- `LogRecord`, `LogContext`, `LogSink`, and `LoggerClock` types stay in
  `domain/`.
- Colors and formatters stay in `presentation/`.
- Fix the typo compatibly:
  - new: `getFormattedName`, `getFormattedLevel`, `getFormattedTime`
  - old: keep `getFormated*` aliases with a `@deprecated` comment.

Validation:

- Current logger tests.
- A specific test guaranteeing the old aliases still work.

### Phase 6 — Reorganize KV ORM

Objective: split `src/orm/kv_repository.ts` into small responsibilities before
adding indexes.

Structure:

```text
src/orm/kv/domain/
src/orm/kv/application/
src/orm/kv/query/
src/orm/kv/mapping/
src/orm/kv/index.ts
src/orm/index.ts
```

Moves:

- Isolated `KvRepository`.
- Isolated `KvQueryBuilder`.
- Isolated KV interfaces/types.
- Isolated operators and comparators.
- Isolated default mapper.

Care points:

- Keep `Box.KvRepository`.
- Keep `import { KvRepository } from "box/orm"`.
- Do not add indexes yet in this phase; first refactor with identical behavior.

### Phase 7 — Public API and barrels review

Objective: ensure the package remains easy to use.

Files:

- `src/mod.ts`
- `src/core/index.ts`
- `src/http/index.ts`
- `src/logger/index.ts`
- `src/orm/index.ts`
- `deno.json`

Criteria:

- `Box` continues exposing the main helpers.
- Subpaths keep working:
  - `box/core`
  - `box/http`
  - `box/logger`
  - `box/orm`
  - `box/adapters/deno`
- Barrels should not import unnecessary expensive dependencies in the hot path.

### Phase 8 — Coverage and quality gates after refactor

After all reorganization:

1. Close coverage for files that get worse because of the move.
2. Add missing tests for:
   - `http/errors`
   - `http/body`
   - `http/router`
   - `http/security`
   - `core/controller`
3. Intermediate target: 95% global.
4. Final project target: 100% unit + integration, according to the enterprise
   goal.

Final commands:

```bash
deno task fmt
deno fmt --check
deno lint
deno task check
deno task test
deno check src/mod.ts src/core/index.ts src/http/index.ts src/logger/index.ts src/orm/index.ts examples/rest-api/main.ts examples/hello-world/main.ts bench/router_bench.ts scripts/measure_startup.ts
rm -rf coverage && deno test --coverage=coverage && deno coverage coverage
deno task bench
deno run scripts/measure_startup.ts
deno eval --ext=ts --unstable-kv '<smoke with Deno.openKv(":memory:") + KvRepository>'
```

## Risks and tradeoffs

### Risk 1 — Breaking public imports

Mitigation:

- Refactor internally, but keep public barrels and exports.
- Public API tests in `tests/unit/public-api/`.

### Risk 2 — Overengineering with files that are too small

Mitigation:

- Separate public classes and real responsibilities.
- Do not split trivial helpers if they only serve one file and do not have their
  own contract.
- Use context-based subfolders to avoid a huge flat folder.

### Risk 3 — Cold start worsening because of heavy barrels

Mitigation:

- Measure startup before/after.
- Avoid runtime/adapters imports in the core.
- Avoid decorators/reflection/auto-scan.
- Keep explicit registration.

### Risk 4 — Refactor masking existing bugs

Mitigation:

- Refactor in small slices.
- Run tests by module after each phase.
- Do not add a feature together with reorganization.

## Open questions

1. Is the desired rule absolutely "one file per exported class/interface/type",
   or can we group small types in `.types.ts` files when they are inseparable?
2. Do you want full compatibility with current public names, including typos
   like `getFormated*`, or can we make breaking changes now because the project
   is still in its initial phase?
3. Do you prefer a more explicit DDD structure
   (`domain/application/infrastructure/presentation`) across all modules, or a
   leaner version only where real complexity exists?

## Recommended next step

Implement Phase 1 first: move tests to `tests/` and update tasks/imports.

Reason:

- It directly addresses one of your complaints.
- It is a low-risk structural change.
- It creates a foundation for refactoring modules without mixing production and
  test code.
- It makes it easier to split unit, integration, and performance later.

After that, move to `src/orm/kv_repository.ts`, which is currently the file with
the clearest SRP break.
