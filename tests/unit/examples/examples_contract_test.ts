import { assertEquals } from "@std/assert";

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
