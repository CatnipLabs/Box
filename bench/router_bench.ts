import { App, json } from "../src/mod.ts";

function buildApp(routeCount: number, middlewareCount = 0): App {
  const app = new App();

  for (let index = 0; index < middlewareCount; index++) {
    app.use(async (_ctx, next) => {
      const response = await next();
      response.headers.set(`x-bench-${index}`, "1");
      return response;
    });
  }

  for (let index = 0; index < routeCount; index++) {
    app.get(`/static-${index}`, () => json({ ok: true, index }));
    app.get(`/users-${index}/:id`, (ctx) => json({ id: ctx.params.id, index }));
  }

  return app;
}

Deno.bench("App: create app with one route", () => {
  const app = new App();
  app.get("/health", () => json({ ok: true }));
});

const singleRouteApp = buildApp(1);
Deno.bench("Router: dispatch static GET route", async () => {
  await singleRouteApp.fetch(new Request("http://localhost/static-0"));
});

Deno.bench("Router: dispatch param GET route", async () => {
  await singleRouteApp.fetch(new Request("http://localhost/users-0/123"));
});

for (const routeCount of [10, 100, 500]) {
  const app = buildApp(routeCount);

  Deno.bench(
    `Router: dispatch static route among ${routeCount} routes`,
    async () => {
      await app.fetch(new Request(`http://localhost/static-${routeCount - 1}`));
    },
  );

  Deno.bench(
    `Router: dispatch param route among ${routeCount} routes`,
    async () => {
      await app.fetch(
        new Request(`http://localhost/users-${routeCount - 1}/123`),
      );
    },
  );
}

const middlewareApp = buildApp(1, 10);
Deno.bench("Router: dispatch through 10 middlewares", async () => {
  await middlewareApp.fetch(new Request("http://localhost/static-0"));
});
