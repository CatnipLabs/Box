import { assertEquals } from "@std/assert";
import { Box } from "../../../src/mod.ts";

Deno.test("Public API: Box exposes declarative createApp for hello-world", async () => {
  @Box.Controller("/health")
  class HealthController {
    @Box.Get()
    public health(): { ok: true } {
      return { ok: true };
    }
  }

  const app = Box.createApp({
    controllers: [HealthController],
  });

  const response = await app.fetch(new Request("http://localhost/health"));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { ok: true });
});

Deno.test("Public API: Box keeps legacy logger under Log subobject", () => {
  const logger = new Box.Log.Logger({
    name: "api",
    level: Box.Log.Levels.INFO,
  });

  assertEquals(logger.getServiceName(), "api");
});

Deno.test("Public API: Box exposes DDD bases", () => {
  class User extends Box.Entity<string> {
    public static readonly testOnly = true;
  }
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
  assertEquals(typeof Box.payloadLimit, "function");
  assertEquals(typeof Box.rateLimit, "function");
  assertEquals(typeof Box.requestTime, "function");
  assertEquals(Box.RequestSizeLimit.MB1, 1_048_576);
  assertEquals(typeof Box.createOpenApiDocument, "function");
  assertEquals(typeof Box.createApp, "function");
  assertEquals(typeof Box.Auth, "function");
  assertEquals(typeof Box.AuthStrategy, "function");
  assertEquals(typeof Box.Consumer, "function");
  assertEquals(typeof Box.denoQueues, "function");
  assertEquals(typeof Box.Event, "function");
  assertEquals(typeof Box.Producer, "function");
  assertEquals(typeof Box.z.object, "function");
});

Deno.test("Public API: Box exposes auth strategy registration and protected routes", async () => {
  @Box.AuthStrategy({ name: "public-api" })
  class PublicApiAuthStrategy {
    public validate(): boolean {
      return true;
    }
  }

  @Box.Controller("/public-api-auth")
  class PublicApiAuthController {
    @Box.Get("/")
    @Box.Auth("public-api")
    public get(): { ok: true } {
      return { ok: true };
    }
  }

  const app = Box.createApp({
    authStrategies: [PublicApiAuthStrategy],
    controllers: [PublicApiAuthController],
  });

  const response = await app.fetch(
    new Request("http://localhost/public-api-auth"),
  );

  assertEquals(response.status, Box.HttpStatus.OK);
  assertEquals(await response.json(), { ok: true });
});

Deno.test("Public API: core submodule remains DI-only and does not export messaging decorators", async () => {
  const core = await import("@catniplabs/box/core");
  const exposed = core as Record<string, unknown>;

  assertEquals(exposed.Event, undefined);
  assertEquals(exposed.Producer, undefined);
  assertEquals(exposed.Consumer, undefined);
});
