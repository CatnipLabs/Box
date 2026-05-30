import { assertEquals } from "@std/assert";

const sourceRoot = new URL("../../../src/", import.meta.url);

const allowedRootEntries = new Set([
  "application",
  "core",
  "domain",
  "infra",
  "logger",
  "mod.ts",
  "presentation",
]);

const architecturalLayerDirectories = new Set([
  "application",
  "domain",
  "infra",
  "presentation",
]);

const sourceDefinitions =
  /^\s*(?:export\s+)?(?:abstract\s+)?(?:class|interface|enum|type)\s+[A-Za-z0-9_]+/gm;

async function collectSourceFiles(directory: URL): Promise<URL[]> {
  const files: URL[] = [];

  for await (const entry of Deno.readDir(directory)) {
    if (entry.name === "coverage") continue;

    const child = new URL(
      entry.name + (entry.isDirectory ? "/" : ""),
      directory,
    );

    if (entry.isDirectory) {
      files.push(...await collectSourceFiles(child));
      continue;
    }

    if (entry.isFile && entry.name.endsWith(".ts")) {
      files.push(child);
    }
  }

  return files;
}

async function collectSourceDirectories(directory: URL): Promise<URL[]> {
  const directories: URL[] = [];

  for await (const entry of Deno.readDir(directory)) {
    if (!entry.isDirectory || entry.name === "coverage") continue;

    const child = new URL(`${entry.name}/`, directory);
    directories.push(child, ...await collectSourceDirectories(child));
  }

  return directories;
}

function relativeToSrc(file: URL): string {
  return file.pathname.slice(sourceRoot.pathname.length);
}

Deno.test({
  name:
    "Architecture: src uses only domain/application/infra/presentation at the root",
  permissions: { read: [sourceRoot] },
  async fn() {
    const forbiddenEntries: string[] = [];

    for await (const entry of Deno.readDir(sourceRoot)) {
      if (!allowedRootEntries.has(entry.name)) {
        forbiddenEntries.push(entry.name);
      }
    }

    assertEquals(forbiddenEntries.sort(), []);
  },
});

Deno.test({
  name: "Architecture: layer names appear only at the src root",
  permissions: { read: [sourceRoot] },
  async fn() {
    const forbiddenDirectories: string[] = [];

    for (const directory of await collectSourceDirectories(sourceRoot)) {
      const relativeDirectory = relativeToSrc(directory).replace(/\/$/, "");
      const parts = relativeDirectory.split("/");
      const directoryName = parts.at(-1);

      if (
        parts.length > 1 && directoryName &&
        architecturalLayerDirectories.has(directoryName)
      ) {
        forbiddenDirectories.push(relativeDirectory);
      }
    }

    assertEquals(forbiddenDirectories.sort(), []);
  },
});

Deno.test({
  name: "Architecture: each production file declares at most one definition",
  permissions: { read: [sourceRoot] },
  async fn() {
    const violations: Array<{ file: string; definitions: string[] }> = [];

    for (const file of await collectSourceFiles(sourceRoot)) {
      const content = await Deno.readTextFile(file);
      const definitions = content.match(sourceDefinitions) ?? [];

      if (definitions.length > 1) {
        violations.push({ file: relativeToSrc(file), definitions });
      }
    }

    assertEquals(violations, []);
  },
});

Deno.test({
  name:
    "Architecture: application messaging does not expose Deno KV queue types",
  permissions: { read: [sourceRoot] },
  async fn() {
    const violations: Array<{ file: string; reason: string }> = [];

    for (
      const file of await collectSourceFiles(
        new URL("application/messaging/", sourceRoot),
      )
    ) {
      const content = await Deno.readTextFile(file);
      if (/\bDeno\.(?:Kv|KvKey|KvCommitResult)\b/.test(content)) {
        violations.push({
          file: relativeToSrc(file),
          reason:
            "application messaging must use framework-owned queue abstractions",
        });
      }
    }

    assertEquals(violations, []);
  },
});

Deno.test({
  name: "Architecture: layer dependencies follow Clean Architecture",
  permissions: { read: [sourceRoot] },
  async fn() {
    const violations: Array<
      { file: string; importPath: string; reason: string }
    > = [];
    const importPattern = /from\s+["']([^"']+)["']/g;

    for (const file of await collectSourceFiles(sourceRoot)) {
      const sourceRelative = relativeToSrc(file);
      const sourceLayer = sourceRelative.split("/")[0];
      const content = await Deno.readTextFile(file);

      for (const match of content.matchAll(importPattern)) {
        const importPath = match[1];
        if (!importPath.startsWith(".")) continue;

        const target = new URL(importPath, file);
        const targetRelative = relativeToSrc(target);
        const targetLayer = targetRelative.split("/")[0];

        if (
          !architecturalLayerDirectories.has(sourceLayer) ||
          !architecturalLayerDirectories.has(targetLayer) ||
          sourceLayer === targetLayer
        ) {
          continue;
        }

        const allowedTargetsByLayer: Record<string, Set<string>> = {
          domain: new Set(),
          application: new Set(["domain"]),
          presentation: new Set(["application", "domain"]),
          infra: new Set(["application", "domain"]),
        };

        if (!allowedTargetsByLayer[sourceLayer].has(targetLayer)) {
          violations.push({
            file: sourceRelative,
            importPath,
            reason:
              `${sourceLayer} must not depend on ${targetLayer} according to the Clean Architecture matrix`,
          });
        }
      }
    }

    assertEquals(violations, []);
  },
});
