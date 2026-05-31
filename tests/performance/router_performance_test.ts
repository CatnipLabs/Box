import { assertEquals, assertLessOrEqual } from "@std/assert";
import { registerRoute } from "../../src/presentation/http/app.ts";

type BoxModule = typeof import("../../src/mod.ts");
type BoxContext = import("../../src/mod.ts").Context;

interface PerformanceSample {
  meanMs: number;
  p95Ms: number;
  maxMs: number;
  totalMs: number;
}

const COLD_IMPORT_MAX_MS = 100;
const FIRST_REQUEST_MAX_MS = 25;
const ROUTER_MEAN_MAX_MS = 5;
const ROUTER_P95_MAX_MS = 20;
const ROUTER_MAX_TOTAL_MS = 5_000;

async function importFreshBoxModule(): Promise<BoxModule> {
  return await import(
    `../../src/mod.ts?perf=${crypto.randomUUID()}`
  ) as BoxModule;
}

function summarize(durations: number[]): PerformanceSample {
  const sorted = durations.toSorted((left, right) => left - right);
  const totalMs = durations.reduce((total, duration) => total + duration, 0);
  const p95Index = Math.ceil(sorted.length * 0.95) - 1;

  return {
    meanMs: totalMs / durations.length,
    p95Ms: sorted[Math.max(0, p95Index)],
    maxMs: sorted.at(-1) ?? 0,
    totalMs,
  };
}

async function measureRouterDispatch(
  app: { fetch(request: Request): Promise<Response> },
  iterations: number,
  urlForIndex: (index: number) => string = (index) =>
    `http://localhost/users/${index}?active=true`,
): Promise<PerformanceSample> {
  const durations: number[] = [];

  for (let index = 0; index < iterations; index++) {
    const request = new Request(urlForIndex(index));
    const startedAt = performance.now();
    const response = await app.fetch(request);
    durations.push(performance.now() - startedAt);
    assertEquals(response.status, 200);
  }

  return summarize(durations);
}

function registerRoutes(
  box: BoxModule,
  app: InstanceType<BoxModule["App"]>,
  count: number,
): void {
  for (let index = 0; index < count; index++) {
    registerRoute(
      app,
      "GET",
      `/static-${index}`,
      () => box.json({ ok: true, index }),
    );
    registerRoute(
      app,
      "GET",
      `/tenants/:tenantId/resources-${index}/:id`,
      (ctx: BoxContext) => {
        return box.json({
          tenantId: ctx.params.tenantId,
          id: ctx.params.id,
          index,
        });
      },
    );
  }
}

Deno.test("Performance: public entrypoint cold import, setup and first request stay serverless-friendly", async () => {
  const importStartedAt = performance.now();
  const box = await importFreshBoxModule();
  const importMs = performance.now() - importStartedAt;

  const app = new box.App();
  registerRoute(app, "GET", "/health", () => box.json({ ok: true }));

  const firstRequestStartedAt = performance.now();
  const response = await app.fetch(new Request("http://localhost/health"));
  const firstRequestMs = performance.now() - firstRequestStartedAt;

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { ok: true });
  assertLessOrEqual(importMs, COLD_IMPORT_MAX_MS);
  assertLessOrEqual(firstRequestMs, FIRST_REQUEST_MAX_MS);
});

Deno.test("Performance: router dispatch keeps low latency under repeated in-process load", async () => {
  const box = await importFreshBoxModule();
  const app = new box.App();

  registerRoute(app, "GET", "/users/:id", (ctx: BoxContext) => {
    return box.json({ id: ctx.params.id, active: ctx.query.get("active") });
  });

  await measureRouterDispatch(app, 100);
  const sample = await measureRouterDispatch(app, 2_000);

  assertLessOrEqual(sample.meanMs, ROUTER_MEAN_MAX_MS);
  assertLessOrEqual(sample.p95Ms, ROUTER_P95_MAX_MS);
  assertLessOrEqual(sample.totalMs, ROUTER_MAX_TOTAL_MS);
});

Deno.test("Performance: router scales across 10, 100 and 500 route tables", async () => {
  const box = await importFreshBoxModule();

  for (const routeCount of [10, 100, 500]) {
    const app = new box.App();
    registerRoutes(box, app, routeCount);

    const staticSample = await measureRouterDispatch(
      app,
      200,
      (index) => `http://localhost/static-${index % routeCount}`,
    );
    const paramSample = await measureRouterDispatch(
      app,
      200,
      (index) =>
        `http://localhost/tenants/t${index}/resources-${
          index % routeCount
        }/r${index}`,
    );

    assertLessOrEqual(staticSample.p95Ms, ROUTER_P95_MAX_MS);
    assertLessOrEqual(paramSample.p95Ms, ROUTER_P95_MAX_MS);
  }
});

Deno.test("Performance: middlewares and small/medium JSON payloads preserve low latency", async () => {
  const box = await importFreshBoxModule();
  const app = new box.App();

  for (let index = 0; index < 10; index++) {
    app.use(async (ctx: BoxContext, next) => {
      ctx.state[`mw${index}`] = true;
      const response = await next();
      response.headers.set(`x-mw-${index}`, "1");
      return response;
    });
  }

  registerRoute(app, "GET", "/ping", () => box.json({ ok: true }));
  registerRoute(app, "POST", "/echo", async (ctx: BoxContext) => {
    const payload = await ctx.json<{ items: string[] }>({ maxBytes: 32_768 });
    return box.json({ count: payload.items.length });
  });

  const payload = JSON.stringify({
    items: Array.from({ length: 100 }, (_, i) => `item-${i}`),
  });
  const sample = await measureRouterDispatch(
    app,
    200,
    () => "http://localhost/ping",
  );

  // Re-run with POST/payload for the actual body path while preserving the same summary contract.
  const durations: number[] = [];
  for (let index = 0; index < 100; index++) {
    const startedAt = performance.now();
    const response = await app.fetch(
      new Request("http://localhost/echo", {
        method: "POST",
        body: payload,
      }),
    );
    durations.push(performance.now() - startedAt);
    assertEquals(response.status, 200);
    assertEquals(await response.json(), { count: 100 });
  }
  const bodySample = summarize(durations);

  assertLessOrEqual(sample.p95Ms, ROUTER_P95_MAX_MS);
  assertLessOrEqual(bodySample.p95Ms, ROUTER_P95_MAX_MS);
});
