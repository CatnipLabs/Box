import { assertEquals, assertMatch } from "@std/assert";
import {
  App,
  HttpError,
  json,
  payloadLimit,
  rateLimit,
  RequestSizeLimit,
  requestTime,
} from "../../../src/presentation/http/index.ts";
import { registerRoute } from "../../../src/presentation/http/app.ts";

type FakeKvEntry<T> = {
  key: readonly Deno.KvKeyPart[];
  value: T | null;
  versionstamp: string | null;
};

class FakeKv {
  private readonly store = new Map<
    string,
    { value: unknown; versionstamp: string }
  >();
  private sequence = 0;
  public conflictsBeforeCommit = 0;

  public get<T>(key: readonly Deno.KvKeyPart[]): Promise<FakeKvEntry<T>> {
    const stored = this.store.get(JSON.stringify(key));
    return Promise.resolve({
      key,
      value: stored ? stored.value as T : null,
      versionstamp: stored?.versionstamp ?? null,
    });
  }

  public atomic(): FakeAtomicOperation {
    return new FakeAtomicOperation(this);
  }

  public readNumber(key: readonly Deno.KvKeyPart[]): number | undefined {
    return this.store.get(JSON.stringify(key))?.value as number | undefined;
  }

  public commit(
    check: FakeKvEntry<unknown> | undefined,
    set: { key: readonly Deno.KvKeyPart[]; value: unknown } | undefined,
  ): { ok: boolean } {
    if (this.conflictsBeforeCommit > 0) {
      this.conflictsBeforeCommit -= 1;
      return { ok: false };
    }

    if (check) {
      const current = this.store.get(JSON.stringify(check.key));
      const currentVersion = current?.versionstamp ?? null;
      if (currentVersion !== check.versionstamp) return { ok: false };
    }

    if (set) {
      this.sequence += 1;
      this.store.set(JSON.stringify(set.key), {
        value: set.value,
        versionstamp: String(this.sequence),
      });
    }

    return { ok: true };
  }
}

class FakeAtomicOperation {
  private checkEntry?: FakeKvEntry<unknown>;
  private setEntry?: { key: readonly Deno.KvKeyPart[]; value: unknown };

  public constructor(private readonly kv: FakeKv) {}

  public check(entry: FakeKvEntry<unknown>): this {
    this.checkEntry = entry;
    return this;
  }

  public set(key: readonly Deno.KvKeyPart[], value: unknown): this {
    this.setEntry = { key, value };
    return this;
  }

  public commit(): Promise<{ ok: boolean }> {
    return Promise.resolve(this.kv.commit(this.checkEntry, this.setEntry));
  }
}

function fakeKv(): Deno.Kv {
  return new FakeKv() as unknown as Deno.Kv;
}

function mutableClock(
  initial: number,
): { now: () => number; set: (value: number) => void } {
  let current = initial;
  return {
    now: () => current,
    set: (value) => current = value,
  };
}

async function errorCode(response: Response): Promise<string> {
  const body = await response.json() as { error: { code: string } };
  return body.error.code;
}

Deno.test("Middleware context: ctx.json reads the current ctx.request after a middleware replaces it", async () => {
  const app = new App();
  app.use((ctx, next) => {
    ctx.request = new Request(ctx.request.url, {
      method: ctx.request.method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "replaced" }),
    });
    return next();
  });
  registerRoute(app, "POST", "/json", async (ctx) => {
    const body = await ctx.json<{ value: string }>();
    return json(body);
  });

  const response = await app.fetch(
    new Request("http://localhost/json", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: "original" }),
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { value: "replaced" });
});

Deno.test("Middleware context: ctx.text reads the current ctx.request after a middleware replaces it", async () => {
  const app = new App();
  app.use((ctx, next) => {
    ctx.request = new Request(ctx.request.url, {
      method: ctx.request.method,
      headers: { "content-type": "text/plain" },
      body: "replaced text",
    });
    return next();
  });
  registerRoute(
    app,
    "POST",
    "/text",
    async (ctx) => json({ value: await ctx.text() }),
  );

  const response = await app.fetch(
    new Request("http://localhost/text", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "original text",
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { value: "replaced text" });
});

Deno.test("requestTime: adds a numeric response time header to successful responses", async () => {
  const app = new App();
  app.use(requestTime());
  registerRoute(app, "GET", "/health", () => json({ ok: true }));

  const response = await app.fetch(new Request("http://localhost/health"));

  assertEquals(response.status, 200);
  assertMatch(response.headers.get("x-response-time-ms") ?? "", /^\d+\.\d{3}$/);
});

Deno.test("requestTime: decorates framework generated errors and handler HttpErrors", async () => {
  const app = new App();
  app.use(requestTime());
  registerRoute(app, "GET", "/bad", () => {
    throw new HttpError(400, "Bad", "bad");
  });

  const missing = await app.fetch(new Request("http://localhost/missing"));
  const bad = await app.fetch(new Request("http://localhost/bad"));

  assertEquals(missing.status, 404);
  assertMatch(missing.headers.get("x-response-time-ms") ?? "", /^\d+\.\d{3}$/);
  assertEquals(bad.status, 400);
  assertMatch(bad.headers.get("x-response-time-ms") ?? "", /^\d+\.\d{3}$/);
});

Deno.test("requestTime: supports custom headers and preserves handler headers by default", async () => {
  const app = new App();
  app.use(requestTime({ headerName: "server-timing-ms" }));
  app.use(requestTime());
  registerRoute(app, "GET", "/manual", () => {
    const response = json({ ok: true });
    response.headers.set("x-response-time-ms", "manual");
    return response;
  });

  const response = await app.fetch(new Request("http://localhost/manual"));

  assertEquals(response.headers.get("x-response-time-ms"), "manual");
  assertMatch(response.headers.get("server-timing-ms") ?? "", /^\d+\.\d{3}$/);
});

Deno.test("payloadLimit: exposes common request size constants for configuration", () => {
  assertEquals(RequestSizeLimit.MB1, 1_048_576);
  assertEquals(RequestSizeLimit.MB10, 10_485_760);
  assertEquals(RequestSizeLimit.KB16, 16_384);
});

Deno.test("payloadLimit: rejects oversized JSON by content length before reading the body", async () => {
  const app = new App();
  app.use(payloadLimit({ jsonMaxBytes: RequestSizeLimit.KB1 }));
  registerRoute(app, "POST", "/json", async (ctx) => json(await ctx.json()));
  const body = JSON.stringify({ value: "x".repeat(RequestSizeLimit.KB1) });

  const response = await app.fetch(
    new Request("http://localhost/json", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(new TextEncoder().encode(body).byteLength),
      },
      body,
    }),
  );

  assertEquals(response.status, 413);
  assertEquals(await errorCode(response), "payload_too_large");
});

Deno.test("payloadLimit: allows multipart uploads over JSON limit but under upload limit", async () => {
  const app = new App();
  app.use(payloadLimit({
    jsonMaxBytes: 8,
    uploadMaxBytes: RequestSizeLimit.KB1,
  }));
  registerRoute(
    app,
    "POST",
    "/upload",
    async (ctx) => json({ size: (await ctx.text()).length }),
  );

  const response = await app.fetch(
    new Request("http://localhost/upload", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=box" },
      body: "12345678901234567890",
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { size: 20 });
});

Deno.test("payloadLimit: treats vendor +json content types as JSON", async () => {
  const app = new App();
  app.use(payloadLimit({ jsonMaxBytes: 8 }));
  registerRoute(app, "POST", "/json", async (ctx) => json(await ctx.json()));

  const response = await app.fetch(
    new Request("http://localhost/json", {
      method: "POST",
      headers: { "content-type": "application/vnd.api+json" },
      body: JSON.stringify({ value: "too-large" }),
    }),
  );

  assertEquals(response.status, 413);
});

Deno.test("payloadLimit: applies the default limit to unknown body content types", async () => {
  const app = new App();
  app.use(payloadLimit({ defaultMaxBytes: 4 }));
  registerRoute(
    app,
    "POST",
    "/text",
    async (ctx) => json({ value: await ctx.text() }),
  );

  const response = await app.fetch(
    new Request("http://localhost/text", {
      method: "POST",
      headers: { "content-type": "text/custom" },
      body: "12345",
    }),
  );

  assertEquals(response.status, 413);
});

Deno.test("payloadLimit: ignores GET requests", async () => {
  const app = new App();
  app.use(payloadLimit({ defaultMaxBytes: 0 }));
  registerRoute(app, "GET", "/health", () => json({ ok: true }));

  const response = await app.fetch(new Request("http://localhost/health"));

  assertEquals(response.status, 200);
});

Deno.test("payloadLimit: rejects oversized content length before pulling the stream", async () => {
  const app = new App();
  app.use(payloadLimit({ uploadMaxBytes: 4 }));
  registerRoute(
    app,
    "POST",
    "/upload",
    async (ctx) => json({ value: await ctx.text() }),
  );
  const stream = new ReadableStream<Uint8Array>({
    pull() {
      throw new Error("stream should not be pulled");
    },
  });

  const response = await app.fetch(
    new Request(
      "http://localhost/upload",
      {
        method: "POST",
        headers: {
          "content-type": "application/octet-stream",
          "content-length": "5",
        },
        body: stream,
        duplex: "half",
      } as RequestInit & { duplex: "half" },
    ),
  );

  assertEquals(response.status, 413);
});

Deno.test("payloadLimit: stops streamed bodies when the limit is exceeded", async () => {
  const app = new App();
  app.use(payloadLimit({ defaultMaxBytes: 5 }));
  registerRoute(
    app,
    "POST",
    "/text",
    async (ctx) => json({ value: await ctx.text() }),
  );
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("123"));
      controller.enqueue(new TextEncoder().encode("456"));
      controller.close();
    },
  });

  const response = await app.fetch(
    new Request(
      "http://localhost/text",
      {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: stream,
        duplex: "half",
      } as RequestInit & { duplex: "half" },
    ),
  );

  assertEquals(response.status, 413);
});

Deno.test("payloadLimit: lets under-limit streamed bodies reach handlers unchanged", async () => {
  const app = new App();
  app.use(payloadLimit({ defaultMaxBytes: 6 }));
  registerRoute(
    app,
    "POST",
    "/text",
    async (ctx) => json({ value: await ctx.text() }),
  );
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("123"));
      controller.enqueue(new TextEncoder().encode("456"));
      controller.close();
    },
  });

  const response = await app.fetch(
    new Request(
      "http://localhost/text",
      {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: stream,
        duplex: "half",
      } as RequestInit & { duplex: "half" },
    ),
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { value: "123456" });
});

Deno.test("rateLimit: allows requests until the IP bucket is exhausted", async () => {
  const clock = mutableClock(0);
  const app = new App();
  app.use(
    rateLimit({ kv: fakeKv(), limit: 2, windowMs: 1_000, clock: clock.now }),
  );
  registerRoute(app, "GET", "/limited", () => json({ ok: true }));
  const init = { headers: { "x-forwarded-for": "198.51.100.10" } };

  const first = await app.fetch(new Request("http://localhost/limited", init));
  const second = await app.fetch(new Request("http://localhost/limited", init));
  const third = await app.fetch(new Request("http://localhost/limited", init));

  assertEquals(first.status, 200);
  assertEquals(first.headers.get("x-ratelimit-limit"), "2");
  assertEquals(first.headers.get("x-ratelimit-remaining"), "1");
  assertEquals(second.status, 200);
  assertEquals(second.headers.get("x-ratelimit-remaining"), "0");
  assertEquals(third.status, 429);
  assertEquals(third.headers.get("retry-after"), "1");
  assertEquals(await errorCode(third), "rate_limit_exceeded");
});

Deno.test("rateLimit: keeps separate buckets per IP and per fixed window", async () => {
  const clock = mutableClock(0);
  const app = new App();
  app.use(
    rateLimit({ kv: fakeKv(), limit: 1, windowMs: 1_000, clock: clock.now }),
  );
  registerRoute(app, "GET", "/limited", () => json({ ok: true }));

  const first = await app.fetch(
    new Request("http://localhost/limited", {
      headers: { "x-forwarded-for": "198.51.100.10" },
    }),
  );
  const otherIp = await app.fetch(
    new Request("http://localhost/limited", {
      headers: { "x-forwarded-for": "203.0.113.20" },
    }),
  );
  const blocked = await app.fetch(
    new Request("http://localhost/limited", {
      headers: { "x-forwarded-for": "198.51.100.10" },
    }),
  );
  clock.set(1_000);
  const nextWindow = await app.fetch(
    new Request("http://localhost/limited", {
      headers: { "x-forwarded-for": "198.51.100.10" },
    }),
  );

  assertEquals(first.status, 200);
  assertEquals(otherIp.status, 200);
  assertEquals(blocked.status, 429);
  assertEquals(nextWindow.status, 200);
});

Deno.test("rateLimit: supports custom identifiers and skip callbacks", async () => {
  const clock = mutableClock(0);
  const app = new App();
  app.use(rateLimit({
    kv: fakeKv(),
    limit: 1,
    windowMs: 1_000,
    clock: clock.now,
    identifier: (ctx) => ctx.request.headers.get("authorization") ?? "guest",
    skip: (ctx) => ctx.url.pathname === "/skip",
  }));
  registerRoute(app, "GET", "/limited", () => json({ ok: true }));
  registerRoute(app, "GET", "/skip", () => json({ ok: true }));

  const tokenA = { headers: { authorization: "Bearer A" } };
  const tokenB = { headers: { authorization: "Bearer B" } };

  assertEquals(
    (await app.fetch(new Request("http://localhost/limited", tokenA))).status,
    200,
  );
  assertEquals(
    (await app.fetch(new Request("http://localhost/limited", tokenA))).status,
    429,
  );
  assertEquals(
    (await app.fetch(new Request("http://localhost/limited", tokenB))).status,
    200,
  );
  assertEquals(
    (await app.fetch(new Request("http://localhost/skip", tokenA))).status,
    200,
  );
});

Deno.test("rateLimit: retries atomic conflicts before allowing the request", async () => {
  const kv = new FakeKv();
  kv.conflictsBeforeCommit = 1;
  const clock = mutableClock(0);
  const app = new App();
  app.use(rateLimit({
    kv: kv as unknown as Deno.Kv,
    limit: 2,
    windowMs: 1_000,
    clock: clock.now,
    namespace: "conflict-test",
  }));
  registerRoute(app, "GET", "/limited", () => json({ ok: true }));

  const response = await app.fetch(
    new Request("http://localhost/limited", {
      headers: { "x-real-ip": "198.51.100.55" },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(
    kv.readNumber(["box", "rate-limit", "conflict-test", "198.51.100.55", 0]),
    1,
  );
});
