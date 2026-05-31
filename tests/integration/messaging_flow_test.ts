import { assertEquals, assertThrows } from "@std/assert";
import {
  Consumer,
  Controller,
  createApp,
  denoQueues,
  Event,
  Get,
  Producer,
  Service,
} from "../../src/mod.ts";
import { FakeKvQueue } from "../fixtures/messaging/fake_kv_queue.ts";

@Event({ name: "orders.created.integration" })
class OrderCreatedEvent extends Event<{ orderId: string }> {
  public static readonly eventName = "orders.created.integration";
}

@Producer({ event: OrderCreatedEvent })
class OrderCreatedProducer extends Producer<OrderCreatedEvent> {
  public static readonly testOnly = true;
}
@Service({ deps: [OrderCreatedProducer] })
class OrdersService {
  public readonly processed: string[] = [];

  public constructor(private readonly producer: OrderCreatedProducer) {}

  public async create(orderId: string): Promise<void> {
    await this.producer.publish({ orderId });
  }

  public process(orderId: string): void {
    this.processed.push(orderId);
  }
}

@Consumer({ event: OrderCreatedEvent, deps: [OrdersService] })
class OrderCreatedConsumer extends Consumer<OrderCreatedEvent> {
  public constructor(private readonly orders: OrdersService) {
    super();
  }

  public handle(event: OrderCreatedEvent): void {
    this.orders.process(event.payload.orderId);
  }
}

@Controller("/orders", { deps: [OrdersService] })
class OrdersController {
  public constructor(private readonly orders: OrdersService) {}

  @Get("/create")
  public async create(): Promise<{ queued: true }> {
    await this.orders.create("ord-42");
    return { queued: true };
  }

  @Get("/processed")
  public processed(): { processed: string[] } {
    return { processed: this.orders.processed };
  }
}

Deno.test("Messaging integration: createApp wires producers, consumers, and shared services", async () => {
  const kv = new FakeKvQueue();
  const app = createApp({
    consumers: [OrderCreatedConsumer],
    controllers: [OrdersController],
    producers: [OrderCreatedProducer],
    queues: denoQueues({ kv }),
    services: [OrdersService],
  });

  const queued = await app.fetch(new Request("http://localhost/orders/create"));

  assertEquals(queued.status, 200);
  assertEquals(await queued.json(), { queued: true });
  assertEquals(kv.enqueued.length, 1);

  await kv.deliver(kv.enqueued[0].value);

  const processed = await app.fetch(
    new Request("http://localhost/orders/processed"),
  );
  assertEquals(processed.status, 200);
  assertEquals(await processed.json(), { processed: ["ord-42"] });
});

Deno.test("Messaging integration: consumers fail closed without queue runtime", () => {
  assertThrows(
    () =>
      createApp({
        consumers: [OrderCreatedConsumer],
        controllers: [],
        producers: [OrderCreatedProducer],
        services: [OrdersService],
      }),
    TypeError,
    "Messaging producers or consumers require createApp({ queues: denoQueues({ kv }) })",
  );
});

Deno.test("Messaging integration: undecorated consumers fail at startup", () => {
  class UndecoratedConsumer extends Consumer<OrderCreatedEvent> {
    public handle(event: OrderCreatedEvent): void {
      assertEquals(event instanceof OrderCreatedEvent, true);
    }
  }

  assertThrows(
    () =>
      createApp({
        consumers: [UndecoratedConsumer],
        controllers: [],
        queues: denoQueues({ kv: new FakeKvQueue() }),
      }),
    TypeError,
    "Provider UndecoratedConsumer must be decorated before registration",
  );
});
