import { assertEquals } from "@std/assert";

const repositoryRoot = new URL("../../../", import.meta.url);
const docsRoots = [
  new URL("README.md", repositoryRoot),
  new URL("docs/wiki/", repositoryRoot),
];
const forbiddenDirectRouteUsage =
  /\bapp\.(?:get|post|put|patch|delete|controller)\s*\(/;

async function collectMarkdownFiles(target: URL): Promise<URL[]> {
  const stat = await Deno.stat(target);
  if (stat.isFile) return target.pathname.endsWith(".md") ? [target] : [];

  const files: URL[] = [];
  for await (const entry of Deno.readDir(target)) {
    const child = new URL(entry.name + (entry.isDirectory ? "/" : ""), target);

    if (entry.isDirectory) {
      files.push(...await collectMarkdownFiles(child));
      continue;
    }

    if (entry.isFile && entry.name.endsWith(".md")) files.push(child);
  }

  return files;
}

function relativeToRepository(file: URL): string {
  return file.pathname.slice(repositoryRoot.pathname.length);
}

Deno.test({
  name: "Docs: primary documentation uses declarative createApp bootstrap",
  permissions: { read: docsRoots },
  async fn() {
    const violations: Array<{ file: string; line: number; content: string }> =
      [];

    for (const root of docsRoots) {
      for (const file of await collectMarkdownFiles(root)) {
        const lines = (await Deno.readTextFile(file)).split("\n");

        lines.forEach((line: string, index: number) => {
          if (forbiddenDirectRouteUsage.test(line)) {
            violations.push({
              content: line.trim(),
              file: relativeToRepository(file),
              line: index + 1,
            });
          }
        });
      }
    }

    assertEquals(violations, []);
  },
});

Deno.test({
  name: "Docs: background jobs docs are linked from primary navigation",
  permissions: { read: docsRoots },
  async fn() {
    const home = await Deno.readTextFile(
      new URL("docs/wiki/Home.md", repositoryRoot),
    );
    const sidebar = await Deno.readTextFile(
      new URL("docs/wiki/_Sidebar.md", repositoryRoot),
    );
    const page = await Deno.readTextFile(
      new URL("docs/wiki/Background-Jobs-with-Deno-Cron.md", repositoryRoot),
    );

    assertEquals(home.includes("Background Jobs with Deno Cron"), true);
    assertEquals(sidebar.includes("Background Jobs with Deno Cron"), true);
    assertEquals(page.includes("Deno.cron"), true);
    assertEquals(page.includes("Deno KV"), true);
    assertEquals(page.includes("JobSchedule"), true);
  },
});
