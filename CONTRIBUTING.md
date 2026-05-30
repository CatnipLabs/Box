# Contributing to Box

Thanks for helping improve Box.

## Development setup

1. Install Deno 2.x.
2. Clone the repository.
3. Run the full local gate before opening a PR:

```bash
deno task fmt --check
deno task lint
deno task check
deno task test:unit
deno task test:integration
deno task test:performance
deno task coverage
deno publish --dry-run
```

## Design principles

- Serverless-first: keep cold start and import graphs small.
- Web Standards first: handlers receive `Request` and return `Response`.
- Explicit registration: no reflection, decorators, filesystem scanning, or
  implicit DI in the hot path.
- DDD-oriented APIs: domain repositories must be typed over entities extending
  `Entity`.
- Tests first: every bug fix and behavior change should start with a failing
  Deno test.

## Pull requests

A good PR includes:

- A focused problem statement.
- Tests for new behavior and regressions.
- Documentation updates when public APIs change.
- Benchmark/performance updates when router, body parsing, logging, ORM, or
  cold-start paths change.

## Release checklist

- Update `CHANGELOG.md`.
- Verify `deno publish --dry-run`.
- Tag the release after CI passes.
