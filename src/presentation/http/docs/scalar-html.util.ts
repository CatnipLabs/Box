import type { ResolvedDocsOptions } from "./resolved-docs-options.interface.ts";

export function scalarHtml(options: ResolvedDocsOptions): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(options.title)} - API Docs</title>
    <style>
      body { margin: 0; background: #0b0f19; }
    </style>
  </head>
  <body>
    <script
      id="api-reference"
      data-url="${escapeHtml(options.openApiPath)}"
      data-theme="${escapeHtml(options.scalar.theme)}"
      data-layout="${escapeHtml(options.scalar.layout)}"
    ></script>
    <script src="${escapeHtml(options.scalar.cdnUrl)}"></script>
    <noscript>Scalar API Reference requires JavaScript.</noscript>
    <!-- Scalar API Reference for ${escapeHtml(options.title)}; config: url: '${
    escapeHtml(options.openApiPath)
  }' -->
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
