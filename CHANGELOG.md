# Changelog

All notable changes to Box will be documented in this file.

The format follows Keep a Changelog and this project uses semantic versioning
after the first stable release.

## [Unreleased]

### Added

- CI workflow for format, lint, type-check, unit/integration/performance tests,
  coverage gate, benchmarks, and JSR publish dry-run.
- Open source community files: contributing guide, security policy, code of
  conduct, issue templates, and PR template.
- Runtime adapter smoke test seam for Deno serve.
- Additional performance scenarios for larger route tables, middleware chains,
  and JSON payloads.
- Configurable Strict-Transport-Security support in `secureHeaders`.
- Coverage gate script with line/branch/function thresholds.

### Changed

- HTTP error responses now flow through application middlewares for consistent
  CORS, secure headers, and request logging.
- Request body helpers enforce limits with `Content-Length` preflight and
  streaming reads.
- Router now has a static-route fast path and buckets parameterized routes by
  first segment.
- `KvQueryBuilder.first()` no longer mutates the builder limit.
- Logger and error serialization now tolerate circular references and `BigInt`
  values.
- Public `./core` entrypoint now points to `src/core/index.ts` while preserving
  compatibility through `src/presentation/core/index.ts`.

### Security

- Unexpected error summaries logged by the HTTP logger are redacted by default.
- CORS rejects `credentials: true` with wildcard origin to avoid invalid browser
  configuration.
