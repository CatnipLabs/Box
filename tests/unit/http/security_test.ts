import { assertEquals } from "@std/assert";
import { App, json } from "../../../src/presentation/http/index.ts";
import {
  cors,
  secureHeaders,
} from "../../../src/presentation/http/security.ts";
import { registerRoute } from "../../../src/presentation/http/app.ts";

Deno.test("Security: secureHeaders applies Helmet-style secure headers", async () => {
  const app = new App();

  app.use(secureHeaders());
  registerRoute(app, "GET", "/health", () => json({ ok: true }));

  const response = await app.fetch(new Request("http://localhost/health"));

  assertEquals(response.headers.get("x-content-type-options"), "nosniff");
  assertEquals(response.headers.get("x-frame-options"), "DENY");
  assertEquals(response.headers.get("referrer-policy"), "no-referrer");
  assertEquals(response.headers.get("x-dns-prefetch-control"), "off");
  assertEquals(
    response.headers.get("cross-origin-opener-policy"),
    "same-origin",
  );
  assertEquals(
    response.headers.get("cross-origin-resource-policy"),
    "same-origin",
  );
});

Deno.test("Security: secureHeaders does not overwrite an already defined header", async () => {
  const app = new App();

  app.use(secureHeaders());
  registerRoute(app, "GET", "/frame", () => {
    const response = json({ ok: true });
    response.headers.set("x-frame-options", "SAMEORIGIN");
    return response;
  });

  const response = await app.fetch(new Request("http://localhost/frame"));

  assertEquals(response.headers.get("x-frame-options"), "SAMEORIGIN");
});

Deno.test("Security: cors applies headers on real requests for an allowed origin", async () => {
  const app = new App();

  app.use(cors({ origin: ["https://app.example.com"], credentials: true }));
  registerRoute(app, "GET", "/users", () => json({ ok: true }));

  const response = await app.fetch(
    new Request("http://localhost/users", {
      headers: { origin: "https://app.example.com" },
    }),
  );

  assertEquals(
    response.headers.get("access-control-allow-origin"),
    "https://app.example.com",
  );
  assertEquals(
    response.headers.get("access-control-allow-credentials"),
    "true",
  );
  assertEquals(response.headers.get("vary"), "Origin");
  assertEquals(await response.json(), { ok: true });
});

Deno.test("Security: cors does not allow origins outside the allowlist", async () => {
  const app = new App();

  app.use(cors({ origin: ["https://app.example.com"] }));
  registerRoute(app, "GET", "/users", () => json({ ok: true }));

  const response = await app.fetch(
    new Request("http://localhost/users", {
      headers: { origin: "https://evil.example.com" },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("access-control-allow-origin"), null);
});

Deno.test("Security: cors responds to global preflight without a registered OPTIONS route", async () => {
  const app = new App();

  app.use(cors({
    origin: "https://app.example.com",
    methods: ["GET", "POST"],
    allowedHeaders: ["authorization", "content-type"],
    maxAge: 600,
  }));
  registerRoute(app, "GET", "/users", () => json({ ok: true }));

  const response = await app.fetch(
    new Request("http://localhost/users", {
      method: "OPTIONS",
      headers: {
        origin: "https://app.example.com",
        "access-control-request-method": "POST",
        "access-control-request-headers": "authorization, content-type",
      },
    }),
  );

  assertEquals(response.status, 204);
  assertEquals(
    response.headers.get("access-control-allow-origin"),
    "https://app.example.com",
  );
  assertEquals(
    response.headers.get("access-control-allow-methods"),
    "GET, POST",
  );
  assertEquals(
    response.headers.get("access-control-allow-headers"),
    "authorization, content-type",
  );
  assertEquals(response.headers.get("access-control-max-age"), "600");
});

Deno.test("Security: cors preserves existing Vary and avoids duplicating Origin", async () => {
  const app = new App();

  app.use(cors({ origin: ["https://app.example.com"] }));
  registerRoute(app, "GET", "/cache", () => {
    const response = json({ ok: true });
    response.headers.set("vary", "Accept-Encoding, origin");
    return response;
  });

  const response = await app.fetch(
    new Request("http://localhost/cache", {
      headers: { origin: "https://app.example.com" },
    }),
  );

  assertEquals(response.headers.get("vary"), "Accept-Encoding, origin");
});
