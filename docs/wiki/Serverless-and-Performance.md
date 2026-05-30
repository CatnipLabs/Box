# Serverless and Performance

BOX was designed for serverless and edge runtimes.

## Principles

- Fetch API-based core.
- Decorator-first DX without `reflect-metadata`.
- No reflection in the hot path.
- No filesystem auto-discovery.
- Explicit route/controller registration.
- Lightweight dependencies in the HTTP core.
- Predictably composed middlewares.

## Fetch-first deployment

```ts
export default {
  fetch: (request: Request) => app.fetch(request),
};
```

This format fits runtimes such as Deno Deploy, Cloudflare Workers, and Fetch
API-compatible serverless environments.

## Local/server Deno

```ts
import { serve } from "@catniplabs/box/adapters/deno";
import app from "./app.ts";

serve(app);
```

## Measuring cold start

The repository includes a measurement script:

```bash
deno run scripts/measure_startup.ts
```

The measurement tracks:

- public entrypoint import time
- time to create the app and register routes
- first request time

## Benchmarks

```bash
deno task bench
```

Current benchmarks cover app creation, static/parameterized route dispatch,
route table scale, and middleware composition overhead.

## Performance tests

```bash
deno task test:performance
```

Performance tests verify thresholds for:

- cold import
- initial setup
- first request
- average router latency
- p95 under in-process load

## Guideline for new features

Before adding magical automation to the framework, evaluate its cold start
impact.

BOX preference:

```text
explicit > magical
simple > too generic
low cold start > reflection-based ergonomics
```
