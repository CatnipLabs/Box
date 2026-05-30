# Tests and Contributing

## Expected quality

BOX should evolve as an open source project with enterprise quality:

- formatted code
- clean lint
- clean type check
- unit tests
- integration tests
- performance tests
- benchmarks
- cold start measurement
- updated documentation

## Required commands before opening a PR

```bash
deno task fmt
deno task lint
deno task check
deno task test
deno task test:unit
deno task test:integration
deno task test:performance
deno task coverage
deno task bench
deno run scripts/measure_startup.ts
```

## Test organization

```text
tests/unit/          -> unit tests
tests/integration/   -> real flows with App, Controller, Service, Repository, middlewares, and errors
tests/performance/   -> performance/cold start thresholds
bench/               -> Deno benchmarks
```

## What to test in new features

Every new feature should include, when applicable:

- happy path tests
- error tests
- HTTP response contract
- integration with controller/service/repository
- security/logging impact
- performance/cold start impact

## Architecture conventions

The project follows a DDD/Clean Architecture separation:

```text
src/domain
src/application
src/infra
src/presentation
```

Avoid inverted dependencies between layers.

## Commits

Use clear and small messages. Examples:

```text
feat: add scalar documentation route
fix: preserve request id in error responses
test: add integration coverage for kv repository
perf: reduce router dispatch allocations
docs: publish framework wiki
```

## Recommended roadmap

- OpenAPI/Scalar documentation route generated automatically from code
  contracts.
- Indexes/materialized access patterns for large Deno KV queries.
- More serverless adapters.
- Project templates.
- Package publishing guide.
- CI with coverage gates.
