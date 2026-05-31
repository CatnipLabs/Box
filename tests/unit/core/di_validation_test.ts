import { assertEquals, assertThrows } from "@std/assert";
import {
  Auth,
  AuthStrategy,
  Consumer,
  Controller,
  createApp,
  denoQueues,
  Event,
  Get,
  Producer,
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
    "Services may inject services, repositories, or producers only",
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

@Event({ name: "di.event" })
class DiEvent extends Event<{ ok: boolean }> {}

@Producer({ event: DiEvent })
class DiProducer extends Producer<DiEvent> {}

@Consumer({ event: DiEvent })
class DiConsumer extends Consumer<DiEvent> {
  public handle(event: DiEvent): void {
    assertEquals(event instanceof DiEvent, true);
  }
}

Deno.test("DI validation: producers may inject services only", () => {
  @Producer({ event: DiEvent, deps: [UsersRepository] })
  class InvalidProducer extends Producer<DiEvent> {}

  assertThrows(
    () =>
      createApp({
        controllers: [],
        producers: [InvalidProducer],
        repositories: [UsersRepository],
        queues: denoQueues({ kv: fakeQueueKv() }),
      }),
    TypeError,
    "Producers may inject services only",
  );
});

Deno.test("DI validation: consumers may inject services only", () => {
  @Consumer({ event: DiEvent, deps: [UsersRepository] })
  class InvalidConsumer extends Consumer<DiEvent> {
    public handle(event: DiEvent): void {
      assertEquals(event instanceof DiEvent, true);
    }
  }

  assertThrows(
    () =>
      createApp({
        consumers: [InvalidConsumer],
        controllers: [],
        repositories: [UsersRepository],
        queues: denoQueues({ kv: fakeQueueKv() }),
      }),
    TypeError,
    "Consumers may inject services only",
  );
});

Deno.test("DI validation: services may inject producers", async () => {
  @Service({ deps: [DiProducer] })
  class PublishingService {
    public constructor(public readonly producer: DiProducer) {}
  }

  @Controller("/producer-service", { deps: [PublishingService] })
  class PublishingController {
    public constructor(private readonly service: PublishingService) {}

    @Get("/")
    public get(): { injected: boolean } {
      return { injected: this.service.producer instanceof DiProducer };
    }
  }

  const app = createApp({
    controllers: [PublishingController],
    producers: [DiProducer],
    queues: denoQueues({ kv: fakeQueueKv() }),
    services: [PublishingService],
  });

  const response = await app.fetch(
    new Request("http://localhost/producer-service"),
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { injected: true });
});

Deno.test("DI validation: producers and consumers may inject services", () => {
  @Service()
  class DependencyService {}

  @Producer({ event: DiEvent, deps: [DependencyService] })
  class ValidProducer extends Producer<DiEvent> {}

  @Consumer({ event: DiEvent, deps: [DependencyService] })
  class ValidConsumer extends Consumer<DiEvent> {
    public constructor(public readonly service: DependencyService) {
      super();
    }

    public handle(event: DiEvent): void {
      assertEquals(event instanceof DiEvent, true);
    }
  }

  const app = createApp({
    consumers: [ValidConsumer],
    controllers: [],
    producers: [ValidProducer],
    queues: denoQueues({ kv: fakeQueueKv() }),
    services: [DependencyService],
  });

  assertEquals(typeof app.fetch, "function");
});

Deno.test("DI validation: services may not inject consumers", () => {
  @Service({ deps: [DiConsumer] })
  class InvalidServiceWithConsumer {}

  assertThrows(
    () =>
      createApp({
        consumers: [DiConsumer],
        controllers: [],
        queues: denoQueues({ kv: fakeQueueKv() }),
        services: [InvalidServiceWithConsumer],
      }),
    TypeError,
    "Services may inject services, repositories, or producers only",
  );
});

function fakeQueueKv() {
  return {
    enqueue(_value: unknown): Promise<Deno.KvCommitResult> {
      return Promise.resolve({
        ok: true,
        versionstamp: "00000000000000010000",
      });
    },
    listenQueue(
      _handler: (value: unknown) => Promise<void> | void,
    ): Promise<void> {
      return Promise.resolve();
    },
  };
}
