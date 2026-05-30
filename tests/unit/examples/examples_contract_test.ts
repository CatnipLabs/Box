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
