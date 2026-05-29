import { assertEquals } from "@std/assert";
import { Box } from "./mod.ts";

Deno.test("Public API: Box expõe App e helper json para hello-world", async () => {
  const app = new Box.App();

  app.get("/health", () => Box.json({ ok: true }));

  const response = await app.fetch(new Request("http://localhost/health"));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { ok: true });
});

Deno.test("Public API: Box mantém logger legado em subobjeto Log", () => {
  const logger = new Box.Log.Logger({
    name: "api",
    level: Box.Log.Levels.INFO,
  });

  assertEquals(logger.getServiceName(), "api");
});
