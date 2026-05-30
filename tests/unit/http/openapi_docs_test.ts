import { assertEquals, assertStringIncludes } from "@std/assert";
import { z } from "zod";
import { Controller } from "../../../src/presentation/controllers/index.ts";
import { App, json } from "../../../src/presentation/http/index.ts";

interface OpenApiParameter {
  name: string;
  in: string;
  required: boolean;
}

interface OpenApiOperation {
  summary?: string;
  description?: string;
  deprecated?: boolean;
  operationId?: string;
  tags?: string[];
  parameters?: OpenApiParameter[];
  requestBody?: {
    content: Record<
      string,
      { schema: { properties: Record<string, { format?: string }> } }
    >;
  };
  responses: Record<
    string,
    {
      description?: string;
      content?: Record<
        string,
        { schema: { properties: Record<string, { type?: string }> } }
      >;
    }
  >;
}

interface OpenApiDocumentForTest {
  openapi: string;
  info: Record<string, string>;
  servers?: Array<{ url: string; description?: string }>;
  paths: Record<string, Record<string, OpenApiOperation> | undefined>;
}

interface ErrorResponseForTest {
  error: {
    code: string;
    message: string;
    details: Array<{ path: string }>;
  };
}

async function jsonBody<T>(response: Response): Promise<T> {
  return await response.json() as T;
}

class UsersController extends Controller {
  public override readonly path = "/users";

  public override routes() {
    const UserResponse = z.object({
      id: z.string().describe("User identifier"),
      name: z.string(),
      active: z.boolean(),
    }).describe("User response");

    return [
      this.get(":id", (ctx) => {
        return json({ id: ctx.params.id, name: "Ada", active: true });
      }, {
        summary: "Find user by id",
        tags: ["Users"],
        request: {
          params: z.object({ id: z.string().uuid() }),
          query: z.object({ includeInactive: z.coerce.boolean().optional() }),
        },
        responses: {
          200: { description: "User found", body: UserResponse },
          404: { description: "User not found" },
        },
      }),
    ];
  }
}

Deno.test("OpenAPI docs: gera documento Scalar/OpenAPI a partir dos schemas Zod das rotas", async () => {
  const CreateUserRequest = z.object({
    name: z.string().min(1),
    email: z.string().email(),
  }).describe("Create user payload");
  const CreateUserResponse = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().email(),
  });

  const app = new App({
    docs: {
      enabled: true,
      title: "Users API",
      version: "1.2.3",
      description: "Documented by Box",
    },
  });

  app.controller(new UsersController());
  app.post("/users", (ctx) => {
    const body = ctx.validated.body as { name: string; email: string };
    return json({ id: "user-1", ...body }, { status: 201 });
  }, {
    summary: "Create user",
    operationId: "createUser",
    tags: ["Users"],
    request: { body: CreateUserRequest },
    responses: {
      201: { description: "User created", body: CreateUserResponse },
    },
  });
  app.get("/internal", () => json({ ok: true }), { docs: false });

  const response = await app.fetch(
    new Request("http://localhost/openapi.json"),
  );
  const document = await jsonBody<OpenApiDocumentForTest>(response);

  assertEquals(response.status, 200);
  assertEquals(document.openapi, "3.1.0");
  assertEquals(document.info, {
    title: "Users API",
    version: "1.2.3",
    description: "Documented by Box",
  });
  const createUserOperation = document.paths["/users"]!.post;
  const findUserOperation = document.paths["/users/{id}"]!.get;

  assertEquals(createUserOperation.operationId, "createUser");
  assertEquals(createUserOperation.tags, ["Users"]);
  assertEquals(
    createUserOperation.requestBody!.content["application/json"].schema
      .properties.email.format,
    "email",
  );
  assertEquals(
    createUserOperation.responses["201"].content!["application/json"].schema
      .properties.name.type,
    "string",
  );
  assertEquals(
    findUserOperation.parameters?.map((parameter) => ({
      name: parameter.name,
      in: parameter.in,
      required: parameter.required,
    })),
    [
      { name: "id", in: "path", required: true },
      { name: "includeInactive", in: "query", required: false },
    ],
  );
  assertEquals(document.paths["/internal"], undefined);
});

Deno.test("OpenAPI docs: cobre defaults, headers, servers, deprecated e content type customizado", async () => {
  const app = new App();
  app.docs({
    title: "Admin API",
    path: "reference",
    openApiPath: "schema.json",
    servers: [{ url: "https://api.example.com", description: "prod" }],
    scalar: { theme: "purple", layout: "classic" },
  });

  app.get("/reports/:id/export", () => new Response("id,total\n1,10"), {
    summary: "Export report",
    description: "CSV report export",
    deprecated: true,
    request: {
      headers: z.object({ authorization: z.string() }),
    },
    responses: {
      200: {
        description: "CSV export",
        contentType: "text/csv",
        body: z.object({ content: z.string() }),
      },
    },
  });
  app.get("/ping", () => json({ ok: true }));

  const docsPage = await app.fetch(new Request("http://localhost/reference"));
  const docsHtml = await docsPage.text();
  const openApiResponse = await app.fetch(
    new Request("http://localhost/schema.json"),
  );
  const document = await jsonBody<OpenApiDocumentForTest>(openApiResponse);

  assertEquals(docsPage.status, 200);
  assertStringIncludes(docsHtml, 'data-theme="purple"');
  assertStringIncludes(docsHtml, 'data-layout="classic"');
  assertStringIncludes(docsHtml, "url: '/schema.json'");
  assertEquals(document.info, { title: "Admin API", version: "1.0.0" });
  assertEquals(document.servers, [
    { url: "https://api.example.com", description: "prod" },
  ]);
  const exportOperation = document.paths["/reports/{id}/export"]!.get;
  assertEquals(exportOperation.summary, "Export report");
  assertEquals(exportOperation.description, "CSV report export");
  assertEquals(exportOperation.deprecated, true);
  assertEquals(
    exportOperation.parameters?.map((parameter) => ({
      name: parameter.name,
      in: parameter.in,
      required: parameter.required,
    })),
    [
      { name: "id", in: "path", required: true },
      { name: "authorization", in: "header", required: true },
    ],
  );
  assertEquals(
    exportOperation.responses["200"].content!["text/csv"].schema.properties
      .content.type,
    "string",
  );
  assertEquals(document.paths["/ping"]!.get.responses["200"], {
    description: "Successful response",
  });
});

Deno.test("OpenAPI docs: expõe página Scalar quando habilitada", async () => {
  const app = new App({
    docs: { enabled: true, title: "Billing API" },
  });

  app.get("/health", () => json({ ok: true }), {
    responses: { 200: { description: "Healthy" } },
  });

  const response = await app.fetch(new Request("http://localhost/docs"));
  const html = await response.text();

  assertEquals(response.status, 200);
  assertStringIncludes(response.headers.get("content-type") ?? "", "text/html");
  assertStringIncludes(html, "Scalar API Reference");
  assertStringIncludes(
    html,
    "https://cdn.jsdelivr.net/npm/@scalar/api-reference",
  );
  assertStringIncludes(html, "url: '/openapi.json'");
  assertStringIncludes(html, "Billing API");
});

Deno.test("OpenAPI docs: pode ser desligada por ambiente", async () => {
  const app = new App({
    docs: { enabled: false, title: "Private API" },
  });

  app.get("/health", () => json({ ok: true }), {
    responses: { 200: { description: "Healthy" } },
  });

  const docsResponse = await app.fetch(new Request("http://localhost/docs"));
  const openApiResponse = await app.fetch(
    new Request("http://localhost/openapi.json"),
  );

  assertEquals(docsResponse.status, 404);
  assertEquals(openApiResponse.status, 404);
});

Deno.test("OpenAPI docs: valida request body com Zod antes do handler e disponibiliza ctx.validated", async () => {
  const app = new App();

  app.post("/orders", (ctx) => {
    const body = ctx.validated.body as { quantity: number };
    return json({ quantity: body.quantity });
  }, {
    request: {
      body: z.object({ quantity: z.coerce.number().int().min(1) }),
    },
    responses: { 200: { description: "Order accepted" } },
  });

  const accepted = await app.fetch(
    new Request("http://localhost/orders", {
      method: "POST",
      body: JSON.stringify({ quantity: "2" }),
    }),
  );
  assertEquals(accepted.status, 200);
  assertEquals(await accepted.json(), { quantity: 2 });

  const rejected = await app.fetch(
    new Request("http://localhost/orders", {
      method: "POST",
      body: JSON.stringify({ quantity: 0 }),
    }),
  );
  const rejectedBody = await rejected.json() as ErrorResponseForTest;

  assertEquals(rejected.status, 400);
  assertEquals(rejectedBody.error.code, "bad_request");
  assertStringIncludes(rejectedBody.error.message, "Invalid request body");
  assertEquals(rejectedBody.error.details[0].path, "quantity");
});

Deno.test("OpenAPI docs: valida params query headers e JSON malformado", async () => {
  const app = new App();

  app.post("/tenants/:tenantId/items", (ctx) => {
    return json(ctx.validated);
  }, {
    request: {
      params: z.object({ tenantId: z.string().min(3) }),
      query: z.object({ tag: z.array(z.string()) }),
      headers: z.object({ "x-api-key": z.string().min(3) }),
      body: z.object({ name: z.string() }),
    },
    responses: { 200: { description: "Validated" } },
  });

  const accepted = await app.fetch(
    new Request("http://localhost/tenants/acme/items?tag=a&tag=b", {
      method: "POST",
      headers: { "x-api-key": "secret" },
      body: JSON.stringify({ name: "Book" }),
    }),
  );
  assertEquals(await accepted.json(), {
    params: { tenantId: "acme" },
    query: { tag: ["a", "b"] },
    headers: { "x-api-key": "secret" },
    body: { name: "Book" },
  });

  const invalidQuery = await app.fetch(
    new Request("http://localhost/tenants/acme/items?tag=a", {
      method: "POST",
      headers: { "x-api-key": "secret" },
      body: JSON.stringify({ name: "Book" }),
    }),
  );
  const invalidQueryBody = await invalidQuery.json() as ErrorResponseForTest;
  assertEquals(invalidQuery.status, 400);
  assertStringIncludes(invalidQueryBody.error.message, "Invalid request query");
  assertEquals(invalidQueryBody.error.details[0].path, "tag");

  const malformedJson = await app.fetch(
    new Request("http://localhost/tenants/acme/items?tag=a&tag=b", {
      method: "POST",
      headers: { "x-api-key": "secret" },
      body: "{",
    }),
  );
  const malformedJsonBody = await malformedJson.json() as ErrorResponseForTest;
  assertEquals(malformedJson.status, 400);
  assertStringIncludes(malformedJsonBody.error.message, "Invalid request body");
  assertEquals(malformedJsonBody.error.details[0].path, "");
});

Deno.test("OpenAPI docs: limita tamanho do body validado por Zod", async () => {
  const app = new App();

  app.post("/uploads", () => json({ ok: true }), {
    request: {
      body: z.object({ name: z.string() }),
      bodyMaxBytes: 16,
    },
    responses: { 200: { description: "Uploaded" } },
  });

  const response = await app.fetch(
    new Request("http://localhost/uploads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "payload-too-large" }),
    }),
  );
  const body = await response.json() as ErrorResponseForTest;

  assertEquals(response.status, 413);
  assertEquals(body.error.code, "payload_too_large");
  assertStringIncludes(body.error.message, "too large");
});
