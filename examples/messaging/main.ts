import { type App, Box, type DenoQueueKv } from "../../src/mod.ts";

@Box.Event({ name: "orders.created" })
class OrderCreatedEvent extends Box.Event<{ orderId: string }> {}

@Box.Producer({ event: OrderCreatedEvent })
class OrderCreatedProducer extends Box.Producer<OrderCreatedEvent> {}

@Box.Service({ deps: [OrderCreatedProducer] })
class OrdersService {
  public constructor(private readonly producer: OrderCreatedProducer) {}

  public async create(orderId: string): Promise<void> {
    await this.producer.publish({ orderId }, {
      backoffSchedule: [1_000, 5_000, 10_000],
      keysIfUndelivered: [["failed_orders", orderId]],
    });
  }
}

@Box.Consumer({ event: OrderCreatedEvent, deps: [OrdersService] })
class OrderCreatedConsumer extends Box.Consumer<OrderCreatedEvent> {
  public constructor(private readonly orders: OrdersService) {
    super();
  }

  public handle(event: OrderCreatedEvent): void {
    console.log("Processing order", event.payload.orderId);
  }
}

@Box.Controller("/orders", { deps: [OrdersService] })
class OrdersController {
  public constructor(private readonly orders: OrdersService) {}

  @Box.Post("/")
  public async create(): Promise<{ queued: true }> {
    await this.orders.create(crypto.randomUUID());
    return { queued: true };
  }
}

export function createMessagingApp(kv: DenoQueueKv): App {
  return Box.createApp({
    consumers: [OrderCreatedConsumer],
    controllers: [OrdersController],
    producers: [OrderCreatedProducer],
    queues: Box.denoQueues({ kv }),
    services: [OrdersService],
  });
}

if (import.meta.main) {
  const kv = await Deno.openKv();
  const app = createMessagingApp(kv);
  Deno.serve((request) => app.fetch(request));
}
