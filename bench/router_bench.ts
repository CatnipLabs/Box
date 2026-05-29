import { App, json } from "../src/mod.ts";

Deno.bench("App: create app with one route", () => {
  const app = new App();
  app.get("/health", () => json({ ok: true }));
});

Deno.bench("Router: dispatch static GET route", async () => {
  const app = new App();
  app.get("/health", () => json({ ok: true }));

  await app.fetch(new Request("http://localhost/health"));
});

Deno.bench("Router: dispatch param GET route", async () => {
  const app = new App();
  app.get("/users/:id", (ctx) => json({ id: ctx.params.id }));

  await app.fetch(new Request("http://localhost/users/123"));
});
