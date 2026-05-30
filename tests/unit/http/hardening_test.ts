import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import {
  App,
  cors,
  HttpError,
  json,
  readText,
  requestLogger,
  secureHeaders,
} from "../../../src/presentation/http/index.ts";

async function errorJson(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

Deno.test("HTTP hardening: 404/405 and handler errors pass through middlewares", async () => {
  const logs: unknown[] = [];
  const logger = {
    info(_message: unknown, context?: unknown): void {
      logs.push({ level: "info", context });
    },
    error(_message: unknown, context?: unknown): void {
      logs.push({ level: "error", context });
    },
  };
  const app = new App();
  app.use(cors({ origin: "https://app.example.com" }));
  app.use(secureHeaders());
  app.use(requestLogger({ logger }));
  app.get("/users", () => json({ ok: true }));
  app.post("/bad", () => {
    throw new HttpError(400, "Bad input", "bad_input");
  });

  const missing = await app.fetch(
    new Request("http://localhost/missing", {
      headers: { origin: "https://app.example.com" },
    }),
  );
  assertEquals(missing.status, 404);
  assertEquals(missing.headers.get("x-content-type-options"), "nosniff");
  assertEquals(
    missing.headers.get("access-control-allow-origin"),
    "https://app.example.com",
  );

  const methodNotAllowed = await app.fetch(
    new Request("http://localhost/users", {
      method: "POST",
      headers: { origin: "https://app.example.com" },
    }),
  );
  assertEquals(methodNotAllowed.status, 405);
  assertEquals(methodNotAllowed.headers.get("allow"), "GET");
  assertEquals(
    methodNotAllowed.headers.get("x-content-type-options"),
    "nosniff",
  );

  const bad = await app.fetch(
    new Request("http://localhost/bad", {
      method: "POST",
      headers: { origin: "https://app.example.com" },
    }),
  );
  assertEquals(bad.status, 400);
  assertEquals(bad.headers.get("x-content-type-options"), "nosniff");
  assertEquals(
    bad.headers.get("access-control-allow-origin"),
    "https://app.example.com",
  );

  assertEquals(logs.length, 3);
});

Deno.test("HTTP hardening: URL path param with invalid percent encoding returns universal 400", async () => {
  const app = new App();
  app.use(secureHeaders());
  app.get("/users/:id", () => json({ ok: true }));

  const response = await app.fetch(
    new Request("http://localhost/users/%E0%A4%A"),
  );

  assertEquals(response.status, 400);
  assertEquals(response.headers.get("x-content-type-options"), "nosniff");
  const body = await errorJson(response);
  assertEquals(body.success, false);
  assertEquals((body.error as Record<string, unknown>).code, "bad_request");
});

Deno.test("HTTP hardening: readText rejects Content-Length above the limit before consuming the body", async () => {
  const stream = new ReadableStream<Uint8Array>({
    pull() {
      throw new Error(
        "body should not be read when content-length exceeds limit",
      );
    },
  });
  const request = new Request(
    "http://localhost/upload",
    {
      method: "POST",
      headers: { "content-length": "6" },
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" },
  );

  await assertRejects(
    () => readText(request, { maxBytes: 5 }),
    HttpError,
    "Request body too large",
  );
});

Deno.test("HTTP hardening: readText stops the stream when the actual limit is exceeded", async () => {
  const request = new Request(
    "http://localhost/upload",
    {
      method: "POST",
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("123"));
          controller.enqueue(new TextEncoder().encode("456"));
          controller.close();
        },
      }),
      duplex: "half",
    } as RequestInit & { duplex: "half" },
  );

  await assertRejects(
    () => readText(request, { maxBytes: 5 }),
    HttpError,
    "Request body too large",
  );
});

Deno.test("HTTP hardening: circular error details and BigInt are serialized safely", async () => {
  const circular: Record<string, unknown> = { id: 1n };
  circular.self = circular;
  const app = new App();
  app.get("/bad", () => {
    throw new HttpError(400, "Bad", "bad", circular);
  });

  const response = await app.fetch(new Request("http://localhost/bad"));

  assertEquals(response.status, 400);
  const body = await errorJson(response);
  const details = ((body.error as Record<string, unknown>).details) as Record<
    string,
    unknown
  >;
  assertEquals(details.id, "1");
  assertEquals(details.self, "[Circular]");
});

Deno.test("HTTP hardening: logger and requestLogger do not break the response when sink/context fails", async () => {
  const app = new App();
  app.use(requestLogger({
    logger: {
      info() {
        throw new Error("sink failed");
      },
      error() {
        throw new Error("sink failed");
      },
    },
  }));
  app.get("/ok", () => json({ ok: true }));

  const response = await app.fetch(new Request("http://localhost/ok"));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { ok: true });
});

Deno.test("HTTP hardening: requestLogger redacts unexpected error messages", async () => {
  const errors: Array<Record<string, unknown>> = [];
  const app = new App();
  app.use(requestLogger({
    logger: {
      info() {},
      error(_message: unknown, context?: Record<string, unknown>) {
        errors.push(context ?? {});
      },
    },
  }));
  app.get("/boom", () => {
    throw new Error("database password leaked");
  });

  const response = await app.fetch(new Request("http://localhost/boom"));

  assertEquals(response.status, 500);
  assertEquals(errors.length, 1);
  const error = errors[0].error as Record<string, unknown>;
  assertEquals(error.message, "Unexpected error");
});

Deno.test("HTTP hardening: cors rejects credentials with wildcard", () => {
  assertThrows(
    () => cors({ origin: "*", credentials: true }),
    TypeError,
    "credentials",
  );
});

Deno.test("HTTP hardening: secureHeaders supports configurable HSTS", async () => {
  const app = new App();
  app.use(secureHeaders({
    strictTransportSecurity: "max-age=31536000; includeSubDomains",
  }));
  app.get("/ok", () => json({ ok: true }));

  const response = await app.fetch(new Request("https://localhost/ok"));

  assertEquals(
    response.headers.get("strict-transport-security"),
    "max-age=31536000; includeSubDomains",
  );
});
