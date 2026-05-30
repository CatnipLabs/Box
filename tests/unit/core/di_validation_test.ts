import { assertEquals, assertThrows } from "@std/assert";
import {
  Auth,
  AuthStrategy,
  Controller,
  createApp,
  Get,
  Repository,
  Service,
} from "../../../src/mod.ts";

@Repository()
class UsersRepository {}

@AuthStrategy({ name: "jwt" })
class JwtAuthStrategy {
  public validate(): boolean {
    return true;
  }
}

Deno.test("DI validation: controller may inject services only", () => {
  @Controller("/invalid", { deps: [UsersRepository] })
  class InvalidController {
    @Get("/")
    public get(): { ok: true } {
      return { ok: true };
    }
  }

  assertThrows(
    () =>
      createApp({
        controllers: [InvalidController],
        repositories: [UsersRepository],
      }),
    TypeError,
    "Controllers may inject services only",
  );
});

Deno.test("DI validation: services may inject services or repositories only", () => {
  @Service({ deps: [JwtAuthStrategy] })
  class InvalidService {}

  @Controller("/invalid-service", { deps: [InvalidService] })
  class InvalidServiceController {
    @Get("/")
    public get(): { ok: true } {
      return { ok: true };
    }
  }

  assertThrows(
    () =>
      createApp({
        authStrategies: [JwtAuthStrategy],
        controllers: [InvalidServiceController],
        services: [InvalidService],
      }),
    TypeError,
    "Services may inject services or repositories only",
  );
});

Deno.test("DI validation: auth strategies may inject services or auth strategies only", () => {
  @AuthStrategy({ name: "invalid", deps: [UsersRepository] })
  class InvalidAuthStrategy {
    public validate(): boolean {
      return true;
    }
  }

  @Controller("/invalid-auth")
  class InvalidAuthController {
    @Get("/")
    @Auth("invalid")
    public get(): { ok: true } {
      return { ok: true };
    }
  }

  assertThrows(
    () =>
      createApp({
        authStrategies: [InvalidAuthStrategy],
        controllers: [InvalidAuthController],
        repositories: [UsersRepository],
      }),
    TypeError,
    "Auth strategies may inject services or auth strategies only",
  );
});

Deno.test("DI validation: allowed controller, service, repository graph starts", async () => {
  @Service({ deps: [UsersRepository] })
  class ValidService {}

  @Controller("/valid", { deps: [ValidService] })
  class ValidController {
    @Get("/")
    public get(): { ok: true } {
      return { ok: true };
    }
  }

  const app = createApp({
    controllers: [ValidController],
    repositories: [UsersRepository],
    services: [ValidService],
  });

  const response = await app.fetch(new Request("http://localhost/valid"));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { ok: true });
});

Deno.test("DI validation: service circular dependencies fail at startup with architecture guidance", () => {
  @Service()
  class CircularUsersService {}

  @Service()
  class OrdersService {}

  Object.assign(CircularUsersService, { dependencies: [OrdersService] });
  Object.assign(OrdersService, { dependencies: [CircularUsersService] });

  @Controller("/circular", { deps: [CircularUsersService] })
  class CircularController {
    @Get("/")
    public get(): { ok: true } {
      return { ok: true };
    }
  }

  assertThrows(
    () =>
      createApp({
        controllers: [CircularController],
        services: [CircularUsersService, OrdersService],
      }),
    TypeError,
    "Circular dependency detected: CircularUsersService -> OrdersService -> CircularUsersService",
  );
});

Deno.test("DI validation: circular dependency error includes architecture warning", () => {
  @Service()
  class FirstService {}

  @Service()
  class SecondService {}

  Object.assign(FirstService, { dependencies: [SecondService] });
  Object.assign(SecondService, { dependencies: [FirstService] });

  @Controller("/cycle-warning", { deps: [FirstService] })
  class CycleWarningController {
    @Get("/")
    public get(): { ok: true } {
      return { ok: true };
    }
  }

  assertThrows(
    () =>
      createApp({
        controllers: [CycleWarningController],
        services: [FirstService, SecondService],
      }),
    TypeError,
    "Circular dependencies usually indicate an architecture decision problem",
  );
});
