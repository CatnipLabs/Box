import { assertEquals } from "@std/assert";
import type {
  BackgroundJobRegistration,
  BackgroundJobRuntime,
  BackgroundJobRuntimeOptions,
} from "../../../src/mod.ts";

const examplesRoot = new URL("../../../examples/", import.meta.url);

const forbiddenDirectRouteUsage =
  /\bapp\.(?:get|post|put|patch|delete|controller)\s*\(/;

async function collectExampleFiles(directory: URL): Promise<URL[]> {
  const files: URL[] = [];

  for await (const entry of Deno.readDir(directory)) {
    const child = new URL(
      entry.name + (entry.isDirectory ? "/" : ""),
      directory,
    );

    if (entry.isDirectory) {
      files.push(...await collectExampleFiles(child));
      continue;
    }

    if (entry.isFile && entry.name.endsWith(".ts")) {
      files.push(child);
    }
  }

  return files;
}

function relativeToExamples(file: URL): string {
  return file.pathname.slice(examplesRoot.pathname.length);
}

Deno.test({
  name: "Examples: official examples use declarative createApp bootstrap",
  permissions: { read: [examplesRoot] },
  async fn() {
    const violations: Array<{ file: string; line: number; content: string }> =
      [];

    for (const file of await collectExampleFiles(examplesRoot)) {
      const lines = (await Deno.readTextFile(file)).split("\n");

      lines.forEach((line, index) => {
        if (forbiddenDirectRouteUsage.test(line)) {
          violations.push({
            content: line.trim(),
            file: relativeToExamples(file),
            line: index + 1,
          });
        }
      });
    }

    assertEquals(violations, []);
  },
});

Deno.test("Examples: hello-world routes are executable", async () => {
  const app = await import("../../../examples/hello-world/main.ts");

  const health = await app.default.fetch(
    new Request("http://localhost/health"),
  );

  assertEquals(health.status, 200);
  assertEquals(await health.json(), { ok: true });

  const hello = await app.default.fetch(
    new Request("http://localhost/hello/Ada"),
  );

  assertEquals(hello.status, 200);
  assertEquals(await hello.json(), { hello: "Ada" });
});

Deno.test("Examples: rest-api demonstrates auth, docs, and CRUD", async () => {
  const app = await import("../../../examples/rest-api/main.ts");

  const unauthorized = await app.default.fetch(
    new Request("http://localhost/users", {
      body: JSON.stringify({ name: "Ada" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
  );

  assertEquals(unauthorized.status, 401);

  const created = await app.default.fetch(
    new Request("http://localhost/users", {
      body: JSON.stringify({ name: "Ada" }),
      headers: {
        authorization: "Bearer valid-jwt",
        "content-type": "application/json",
      },
      method: "POST",
    }),
  );

  assertEquals(created.status, 201);
  const user = await created.json();
  assertEquals(user.name, "Ada");

  const found = await app.default.fetch(
    new Request(`http://localhost/users/${user.id}`),
  );

  assertEquals(found.status, 200);
  assertEquals(await found.json(), user);

  const docs = await app.default.fetch(new Request("http://localhost/docs"));
  assertEquals(docs.status, 200);
});

Deno.test("Examples: auth-strategy protects a controller", async () => {
  const app = await import("../../../examples/auth-strategy/main.ts");

  const unauthorized = await app.default.fetch(
    new Request("http://localhost/reports"),
  );
  assertEquals(unauthorized.status, 401);

  const authorized = await app.default.fetch(
    new Request("http://localhost/reports", {
      headers: { "x-api-key": "demo-api-key" },
    }),
  );
  assertEquals(authorized.status, 200);
  assertEquals(await authorized.json(), {
    reports: ["daily-sales", "stock-alerts"],
  });
});

Deno.test("Examples: messaging demonstrates Deno Queues producers and consumers", async () => {
  const example = await import("../../../examples/messaging/main.ts");
  const kv = new ExampleFakeQueue();
  const app = example.createMessagingApp(kv);

  const response = await app.fetch(
    new Request("http://localhost/orders", { method: "POST" }),
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { queued: true });
  assertEquals(kv.enqueued.length, 1);
});

Deno.test("Examples: background-jobs demonstrates Deno Cron registration", async () => {
  const example = await import("../../../examples/background-jobs/main.ts");
  const scheduler = new ExampleBackgroundJobScheduler();
  const app = example.createBackgroundJobApp(scheduler);

  assertEquals(scheduler.runtime.registrations.length, 1);
  const registration = scheduler.runtime.registrations[0];
  assertEquals(registration.name, "inventory.cleanup");
  assertEquals(registration.schedule, "*/15 * * * *");

  await registration.instance.run({
    name: registration.name,
    runId: "example-run",
    scheduledAt: new Date("2026-05-30T20:00:00.000Z"),
    signal: new AbortController().signal,
    startedAt: new Date("2026-05-30T20:00:00.000Z"),
  });

  const response = await app.fetch(
    new Request("http://localhost/jobs/inventory-cleanup"),
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    lastRunAt: "2026-05-30T20:00:00.000Z",
    runs: 1,
  });
});

class ExampleBackgroundJobScheduler implements BackgroundJobRuntimeOptions {
  public readonly runtime = new ExampleBackgroundJobRuntime();

  public createRuntime(): BackgroundJobRuntime {
    return this.runtime;
  }
}

class ExampleBackgroundJobRuntime implements BackgroundJobRuntime {
  public readonly registrations: BackgroundJobRegistration[] = [];

  public bindBackgroundJobs(
    registrations: readonly BackgroundJobRegistration[],
  ): void {
    this.registrations.push(...registrations);
  }
}

class ExampleFakeQueue {
  public readonly enqueued: Array<{ value: unknown; options?: unknown }> = [];

  public enqueue(
    value: unknown,
    options?: unknown,
  ): Promise<Deno.KvCommitResult> {
    this.enqueued.push({ value, options });
    return Promise.resolve({ ok: true, versionstamp: "00000000000000010000" });
  }

  public listenQueue(
    _handler: (value: unknown) => Promise<void> | void,
  ): Promise<void> {
    return Promise.resolve();
  }
}
