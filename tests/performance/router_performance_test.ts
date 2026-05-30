import { assertEquals, assertLessOrEqual } from "@std/assert";

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
  const sorted = [...durations].sort((left, right) => left - right);
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
): Promise<PerformanceSample> {
  const durations: number[] = [];

  for (let index = 0; index < iterations; index++) {
    const request = new Request(`http://localhost/users/${index}?active=true`);
    const startedAt = performance.now();
    const response = await app.fetch(request);
    durations.push(performance.now() - startedAt);
    assertEquals(response.status, 200);
  }

  return summarize(durations);
}

Deno.test("Performance: public entrypoint cold import, setup and first request stay serverless-friendly", async () => {
  const importStartedAt = performance.now();
  const box = await importFreshBoxModule();
  const importMs = performance.now() - importStartedAt;

  const app = new box.App();
  app.get("/health", () => box.json({ ok: true }));

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

  app.get("/users/:id", (ctx: BoxContext) => {
    return box.json({ id: ctx.params.id, active: ctx.query.get("active") });
  });

  await measureRouterDispatch(app, 100);
  const sample = await measureRouterDispatch(app, 2_000);

  assertLessOrEqual(sample.meanMs, ROUTER_MEAN_MAX_MS);
  assertLessOrEqual(sample.p95Ms, ROUTER_P95_MAX_MS);
  assertLessOrEqual(sample.totalMs, ROUTER_MAX_TOTAL_MS);
});
