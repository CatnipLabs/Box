import { assertEquals, assertMatch } from "@std/assert";
import {
  App,
  json,
  payloadLimit,
  rateLimit,
  requestTime,
} from "../../src/presentation/http/index.ts";
import { registerRoute } from "../../src/presentation/http/app.ts";

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

  public commit(
    check: FakeKvEntry<unknown> | undefined,
    set: { key: readonly Deno.KvKeyPart[]; value: unknown } | undefined,
  ): { ok: boolean } {
    if (check) {
      const current = this.store.get(JSON.stringify(check.key));
      if ((current?.versionstamp ?? null) !== check.versionstamp) {
        return { ok: false };
      }
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

Deno.test("Integration: built-in middlewares compose through the real App pipeline", async () => {
  const app = new App();
  app.use(requestTime());
  app.use(
    payloadLimit({ jsonMaxBytes: 16, uploadMaxBytes: 64, defaultMaxBytes: 16 }),
  );
  app.use(rateLimit({
    kv: new FakeKv() as unknown as Deno.Kv,
    limit: 2,
    windowMs: 60_000,
    clock: () => 0,
  }));

  registerRoute(app, "POST", "/json", async (ctx) => json(await ctx.json()));
  registerRoute(
    app,
    "POST",
    "/upload",
    async (ctx) => json({ size: (await ctx.text()).length }),
  );

  const ipHeaders = { "x-forwarded-for": "198.51.100.42" };
  const ok = await app.fetch(
    new Request("http://localhost/json", {
      method: "POST",
      headers: { ...ipHeaders, "content-type": "application/json" },
      body: JSON.stringify({ a: 1 }),
    }),
  );
  const oversizedJsonBody = JSON.stringify({ value: "too-large" });
  const oversizedJson = await app.fetch(
    new Request("http://localhost/json", {
      method: "POST",
      headers: {
        ...ipHeaders,
        "content-type": "application/json",
        "content-length": String(
          new TextEncoder().encode(oversizedJsonBody).byteLength,
        ),
      },
      body: oversizedJsonBody,
    }),
  );
  const upload = await app.fetch(
    new Request("http://localhost/upload", {
      method: "POST",
      headers: {
        ...ipHeaders,
        "content-type": "multipart/form-data; boundary=box",
      },
      body: "12345678901234567890",
    }),
  );
  const rateLimited = await app.fetch(
    new Request("http://localhost/json", {
      method: "POST",
      headers: { ...ipHeaders, "content-type": "application/json" },
      body: JSON.stringify({ a: 1 }),
    }),
  );

  assertEquals(ok.status, 200);
  assertMatch(ok.headers.get("x-response-time-ms") ?? "", /^\d+\.\d{3}$/);
  assertEquals(ok.headers.get("x-ratelimit-limit"), "2");
  assertEquals(ok.headers.get("x-ratelimit-remaining"), "1");

  assertEquals(oversizedJson.status, 413);
  assertMatch(
    oversizedJson.headers.get("x-response-time-ms") ?? "",
    /^\d+\.\d{3}$/,
  );

  assertEquals(upload.status, 200);
  assertEquals(await upload.json(), { size: 20 });
  assertEquals(upload.headers.get("x-ratelimit-remaining"), "0");

  assertEquals(rateLimited.status, 429);
  assertEquals(rateLimited.headers.get("retry-after"), "60");
});
