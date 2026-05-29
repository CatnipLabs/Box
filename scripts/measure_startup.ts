export {};

const startedAt = performance.now();
const module = await import("../src/mod.ts");
const importedAt = performance.now();

const app = new module.App();
app.get("/health", () => module.json({ ok: true }));
const readyAt = performance.now();

const response = await app.fetch(new Request("http://localhost/health"));
await response.text();
const firstRequestAt = performance.now();

console.log(JSON.stringify(
  {
    importMs: importedAt - startedAt,
    createAndRegisterMs: readyAt - importedAt,
    firstRequestMs: firstRequestAt - readyAt,
  },
  null,
  2,
));
