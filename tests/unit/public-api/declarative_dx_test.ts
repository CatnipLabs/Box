import { assertEquals } from "@std/assert";
import {
  type Body,
  Box,
  Controller,
  createApp,
  Get,
  type MessageCommitResult,
  type Param,
  Post,
  type Query,
  Repository,
  Service,
  z,
} from "@catniplabs/box";

const PublicUserParams = z.object({
  id: z.string().min(1),
});

const PublicUserQuery = z.object({
  includePosts: z.enum(["true", "false"]).default("false"),
});

const PublicCreateUserBody = z.object({
  name: z.string().min(1),
});

type PublicUserParams = z.infer<typeof PublicUserParams>;
type PublicUserQuery = z.infer<typeof PublicUserQuery>;
type PublicCreateUserBody = z.infer<typeof PublicCreateUserBody>;

class PublicApiPrefix {
  public constructor(public readonly value: string) {}
}

@Repository({ deps: [PublicApiPrefix] })
class PublicUsersRepository {
  public static instances = 0;

  public constructor(private readonly prefix: PublicApiPrefix) {
    PublicUsersRepository.instances += 1;
  }

  public findLabel(id: string): string {
    return `${this.prefix.value}:User ${id}`;
  }

  public createName(name: string): string {
    return `${this.prefix.value}:${name}`;
  }
}

@Service({ deps: [PublicUsersRepository] })
class PublicUsersService {
  public constructor(private readonly users: PublicUsersRepository) {}

  public find(id: string, includePosts: boolean): Record<string, unknown> {
    return {
      id,
      includePosts,
      label: this.users.findLabel(id),
    };
  }

  public create(input: PublicCreateUserBody): Record<string, string> {
    return {
      id: "created-user",
      name: this.users.createName(input.name),
    };
  }
}

@Controller("/public-users", { deps: [PublicUsersService] })
class PublicUsersController {
  public constructor(private readonly users: PublicUsersService) {}

  @Get(":id", {
    request: {
      params: PublicUserParams,
      query: PublicUserQuery,
    },
  })
  public findById(
    input: Param<PublicUserParams> & Query<PublicUserQuery>,
  ): Record<string, unknown> {
    return this.users.find(
      input.params.id,
      input.query.includePosts === "true",
    );
  }

  @Post("/", {
    status: Box.HttpStatus.CREATED,
    request: {
      body: PublicCreateUserBody,
    },
  })
  public create(input: Body<PublicCreateUserBody>): Record<string, string> {
    return this.users.create(input.body);
  }
}

Deno.test("Public DX: @catniplabs/box exposes declarative controllers, DI, typed input, z, and createApp", async () => {
  PublicUsersRepository.instances = 0;

  const app = createApp({
    controllers: [PublicUsersController],
    providers: [{
      provide: PublicApiPrefix,
      useValue: new PublicApiPrefix("pkg"),
    }],
    repositories: [PublicUsersRepository],
    services: [PublicUsersService],
  });

  const found = await app.fetch(
    new Request("http://localhost/public-users/42?includePosts=true"),
  );

  assertEquals(found.status, 200);
  assertEquals(await found.json(), {
    id: "42",
    includePosts: true,
    label: "pkg:User 42",
  });

  const created = await app.fetch(
    new Request("http://localhost/public-users", {
      body: JSON.stringify({ name: "Ada" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
  );

  assertEquals(created.status, Box.HttpStatus.CREATED);
  assertEquals(await created.json(), {
    id: "created-user",
    name: "pkg:Ada",
  });

  const invalid = await app.fetch(
    new Request("http://localhost/public-users", {
      body: JSON.stringify({ name: "" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
  );

  assertEquals(invalid.status, Box.HttpStatus.BAD_REQUEST);
  assertEquals(PublicUsersRepository.instances, 1);
  assertEquals(Box.createApp, createApp);
  assertEquals(Box.HttpStatus.OK, 200);
  assertEquals(typeof Controller, "function");
});

Deno.test("Public DX: Box.App no longer exposes low-level route registration methods", () => {
  const app = new Box.App();

  for (
    const method of [
      "get",
      "post",
      "put",
      "patch",
      "delete",
      "route",
      "controller",
    ]
  ) {
    assertEquals(method in app, false, `${method} should not be public`);
  }
});

@Box.Event({ name: "public.user.created" })
class PublicUserCreatedEvent extends Box.Event<{ userId: string }> {}

@Box.Producer({ event: PublicUserCreatedEvent })
class PublicUserCreatedProducer extends Box.Producer<PublicUserCreatedEvent> {}

@Service({ deps: [PublicUserCreatedProducer] })
class PublicUserMessagingService {
  public constructor(private readonly producer: PublicUserCreatedProducer) {}

  public publish(userId: string): Promise<MessageCommitResult> {
    return this.producer.publish({ userId });
  }
}

@Box.Consumer({
  event: PublicUserCreatedEvent,
  deps: [PublicUserMessagingService],
})
class PublicUserCreatedConsumer extends Box.Consumer<PublicUserCreatedEvent> {
  public seen: string[] = [];

  public handle(event: PublicUserCreatedEvent): void {
    this.seen.push(event.payload.userId);
  }
}

Deno.test("Public DX: Box exposes messaging events, producers, consumers, and denoQueues", async () => {
  const kv = new PublicApiFakeQueue();

  @Controller("/public-user-messages", { deps: [PublicUserMessagingService] })
  class PublicUserMessagingController {
    public constructor(private readonly messages: PublicUserMessagingService) {}

    @Post("/")
    public async publish(): Promise<{ queued: true }> {
      await this.messages.publish("user-1");
      return { queued: true };
    }
  }

  const app = createApp({
    consumers: [PublicUserCreatedConsumer],
    controllers: [PublicUserMessagingController],
    producers: [PublicUserCreatedProducer],
    queues: Box.denoQueues({ kv }),
    services: [PublicUserMessagingService],
  });

  const response = await app.fetch(
    new Request("http://localhost/public-user-messages", { method: "POST" }),
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { queued: true });
  assertEquals(kv.enqueued.length, 1);
});

Deno.test("Public DX: @catniplabs/box/messaging exposes Deno Queue helpers", async () => {
  const messaging = await import("@catniplabs/box/messaging");

  assertEquals(typeof messaging.denoQueues, "function");
  assertEquals(typeof messaging.DenoQueueRuntime, "function");
});

class PublicApiFakeQueue {
  public readonly enqueued: Array<{ value: unknown; options?: unknown }> = [];

  public enqueue(
    value: unknown,
    options?: unknown,
  ): Promise<Deno.KvCommitResult> {
    this.enqueued.push({ value, options });
    return Promise.resolve({ ok: true, versionstamp: "00000000000000010000" });
  }

  public listenQueue(
    _handler: (value: unknown) => Promise<void> | void,
  ): Promise<void> {
    return Promise.resolve();
  }
}
