import { assertEquals, assertRejects } from "@std/assert";
import { App, HttpError, json, readJson, readText } from "./index.ts";

async function bodyJson<T>(response: Response): Promise<T> {
  return await response.json() as T;
}

Deno.test("App: responde rota GET com JSON", async () => {
  const app = new App();

  app.get("/health", () => json({ ok: true }));

  const response = await app.fetch(new Request("http://localhost/health"));

  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("content-type"),
    "application/json; charset=utf-8",
  );
  assertEquals(await bodyJson(response), { ok: true });
});

Deno.test("App: resolve params e query em rotas REST", async () => {
  const app = new App();

  app.get("/users/:userId/orders/:orderId", (ctx) => {
    return json({
      userId: ctx.params.userId,
      orderId: ctx.params.orderId,
      page: ctx.query.get("page"),
    });
  });

  const response = await app.fetch(
    new Request("http://localhost/users/123/orders/abc?page=2"),
  );

  assertEquals(response.status, 200);
  assertEquals(await bodyJson(response), {
    userId: "123",
    orderId: "abc",
    page: "2",
  });
});

Deno.test("App: responde 404 JSON quando rota não existe", async () => {
  const app = new App();

  const response = await app.fetch(new Request("http://localhost/missing"));

  assertEquals(response.status, 404);
  assertEquals(await bodyJson(response), {
    status: 404,
    error: "not_found",
    message: "Route not found",
  });
});

Deno.test("App: responde 405 quando path existe para outro método", async () => {
  const app = new App();

  app.get("/users", () => json({ ok: true }));

  const response = await app.fetch(
    new Request("http://localhost/users", {
      method: "POST",
    }),
  );

  assertEquals(response.status, 405);
  assertEquals(response.headers.get("allow"), "GET");
  assertEquals(await bodyJson(response), {
    status: 405,
    error: "method_not_allowed",
    message: "Method not allowed",
  });
});

Deno.test("App: executa middleware em ordem e compartilha state", async () => {
  const app = new App();
  const calls: string[] = [];

  app.use(async (ctx, next) => {
    calls.push("before-1");
    ctx.state.requestId = "req-1";
    const response = await next();
    calls.push("after-1");
    response.headers.set("x-request-id", String(ctx.state.requestId));
    return response;
  });

  app.use(async (_ctx, next) => {
    calls.push("before-2");
    const response = await next();
    calls.push("after-2");
    return response;
  });

  app.get("/middleware", (ctx) => json({ requestId: ctx.state.requestId }));

  const response = await app.fetch(new Request("http://localhost/middleware"));

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("x-request-id"), "req-1");
  assertEquals(await bodyJson(response), { requestId: "req-1" });
  assertEquals(calls, ["before-1", "before-2", "after-2", "after-1"]);
});

Deno.test("App: transforma HttpError em resposta JSON segura", async () => {
  const app = new App();

  app.get("/bad", () => {
    throw new HttpError(400, "Invalid payload", "invalid_payload", {
      field: "name",
    });
  });

  const response = await app.fetch(new Request("http://localhost/bad"));

  assertEquals(response.status, 400);
  assertEquals(await bodyJson(response), {
    status: 400,
    error: "invalid_payload",
    message: "Invalid payload",
    details: { field: "name" },
  });
});

Deno.test("App: transforma erro inesperado em 500 sem vazar stack", async () => {
  const app = new App();

  app.get("/boom", () => {
    throw new Error("database password leaked");
  });

  const response = await app.fetch(new Request("http://localhost/boom"));

  assertEquals(response.status, 500);
  assertEquals(await bodyJson(response), {
    status: 500,
    error: "internal_server_error",
    message: "Internal server error",
  });
});

Deno.test("Body: readJson lê payload JSON com limite explícito", async () => {
  const request = new Request("http://localhost/users", {
    method: "POST",
    body: JSON.stringify({ name: "Ada" }),
  });

  const result = await readJson<{ name: string }>(request, { maxBytes: 100 });

  assertEquals(result, { name: "Ada" });
});

Deno.test("Body: readText rejeita payload acima do limite", async () => {
  const request = new Request("http://localhost/users", {
    method: "POST",
    body: "123456",
  });

  await assertRejects(
    () => readText(request, { maxBytes: 5 }),
    HttpError,
    "Request body too large",
  );
});
