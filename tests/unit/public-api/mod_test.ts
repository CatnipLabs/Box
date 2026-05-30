import { assertEquals } from "@std/assert";
import { Box } from "../../../src/mod.ts";

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

Deno.test("Public API: Box expõe bases DDD", () => {
  class User extends Box.Entity<string> {}
  class UsersRepository extends Box.Repository<User> {
    constructor() {
      super(User);
    }
  }

  const repository = new UsersRepository();

  assertEquals(repository.entityName, "User");
  assertEquals(new Box.Service().serviceName, "Service");
  assertEquals(new Box.Controller().routes(), []);
  assertEquals(typeof Box.cors, "function");
  assertEquals(typeof Box.KvRepository, "function");
  assertEquals(typeof Box.requestLogger, "function");
  assertEquals(typeof Box.secureHeaders, "function");
  assertEquals(typeof Box.createOpenApiDocument, "function");
  assertEquals(typeof Box.z.object, "function");
});
