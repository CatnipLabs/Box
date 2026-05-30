import type { DocsOptions } from "./docs-options.interface.ts";
import type { ResolvedDocsOptions } from "./resolved-docs-options.interface.ts";

const DEFAULT_SCALAR_CDN = "https://cdn.jsdelivr.net/npm/@scalar/api-reference";

export function resolveDocsOptions(
  options: DocsOptions | false | undefined,
): ResolvedDocsOptions | undefined {
  if (options === undefined || options === false) return undefined;

  return {
    enabled: options.enabled ?? true,
    title: options.title ?? "Box API",
    version: options.version ?? "1.0.0",
    description: options.description,
    path: normalizeDocsPath(options.path ?? "/docs"),
    openApiPath: normalizeDocsPath(options.openApiPath ?? "/openapi.json"),
    servers: options.servers ?? [],
    scalar: {
      cdnUrl: options.scalar?.cdnUrl ?? DEFAULT_SCALAR_CDN,
      theme: options.scalar?.theme ?? "default",
      layout: options.scalar?.layout ?? "modern",
    },
  };
}

function normalizeDocsPath(path: string): string {
  if (!path.startsWith("/")) return `/${path}`;
  return path;
}
