import { assertEquals } from "@std/assert";
import { empty, json, redirect, text } from "./response.ts";

Deno.test("Response: json define content-type e serializa objeto", async () => {
  const response = json({ ok: true }, { status: 201 });

  assertEquals(response.status, 201);
  assertEquals(
    response.headers.get("content-type"),
    "application/json; charset=utf-8",
  );
  assertEquals(await response.json(), { ok: true });
});

Deno.test("Response: text define content-type padrão", async () => {
  const response = text("hello", { status: 202 });

  assertEquals(response.status, 202);
  assertEquals(
    response.headers.get("content-type"),
    "text/plain; charset=utf-8",
  );
  assertEquals(await response.text(), "hello");
});

Deno.test("Response: empty retorna resposta sem body", async () => {
  const response = empty();

  assertEquals(response.status, 204);
  assertEquals(await response.text(), "");
});

Deno.test("Response: redirect retorna Location e status", () => {
  const response = redirect("https://example.com/login", 302);

  assertEquals(response.status, 302);
  assertEquals(response.headers.get("location"), "https://example.com/login");
});
