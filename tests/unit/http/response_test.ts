import { assertEquals } from "@std/assert";
import {
  empty,
  json,
  redirect,
  text,
} from "../../../src/presentation/http/response.ts";

Deno.test("Response: json sets content-type and serializes object", async () => {
  const response = json({ ok: true }, { status: 201 });

  assertEquals(response.status, 201);
  assertEquals(
    response.headers.get("content-type"),
    "application/json; charset=utf-8",
  );
  assertEquals(await response.json(), { ok: true });
});

Deno.test("Response: text sets the default content-type", async () => {
  const response = text("hello", { status: 202 });

  assertEquals(response.status, 202);
  assertEquals(
    response.headers.get("content-type"),
    "text/plain; charset=utf-8",
  );
  assertEquals(await response.text(), "hello");
});

Deno.test("Response: empty returns a response without a body", async () => {
  const response = empty();

  assertEquals(response.status, 204);
  assertEquals(await response.text(), "");
});

Deno.test("Response: redirect returns Location and status", () => {
  const response = redirect("https://example.com/login", 302);

  assertEquals(response.status, 302);
  assertEquals(response.headers.get("location"), "https://example.com/login");
});
