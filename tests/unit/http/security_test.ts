import { assertEquals } from "@std/assert";
import { App, json } from "../../../src/presentation/http/index.ts";
import {
  cors,
  secureHeaders,
} from "../../../src/presentation/http/security.ts";

Deno.test("Security: secureHeaders aplica headers seguros estilo Helmet", async () => {
  const app = new App();

  app.use(secureHeaders());
  app.get("/health", () => json({ ok: true }));

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

Deno.test("Security: secureHeaders não sobrescreve header já definido", async () => {
  const app = new App();

  app.use(secureHeaders());
  app.get("/frame", () => {
    const response = json({ ok: true });
    response.headers.set("x-frame-options", "SAMEORIGIN");
    return response;
  });

  const response = await app.fetch(new Request("http://localhost/frame"));

  assertEquals(response.headers.get("x-frame-options"), "SAMEORIGIN");
});

Deno.test("Security: cors aplica headers em requests reais para origem permitida", async () => {
  const app = new App();

  app.use(cors({ origin: ["https://app.example.com"], credentials: true }));
  app.get("/users", () => json({ ok: true }));

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

Deno.test("Security: cors não libera origem fora da allowlist", async () => {
  const app = new App();

  app.use(cors({ origin: ["https://app.example.com"] }));
  app.get("/users", () => json({ ok: true }));

  const response = await app.fetch(
    new Request("http://localhost/users", {
      headers: { origin: "https://evil.example.com" },
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(response.headers.get("access-control-allow-origin"), null);
});

Deno.test("Security: cors responde preflight global sem rota OPTIONS registrada", async () => {
  const app = new App();

  app.use(cors({
    origin: "https://app.example.com",
    methods: ["GET", "POST"],
    allowedHeaders: ["authorization", "content-type"],
    maxAge: 600,
  }));
  app.get("/users", () => json({ ok: true }));

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

Deno.test("Security: cors preserva Vary existente e evita duplicar Origin", async () => {
  const app = new App();

  app.use(cors({ origin: ["https://app.example.com"] }));
  app.get("/cache", () => {
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
