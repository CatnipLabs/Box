# Messaging with Deno Queues

BOX supports lightweight background messaging on top of Deno KV Queues. The
public API follows the same framework pattern as
controllers/services/repositories: create an `Event`, publish it with a
`Producer`, and process it with a `Consumer`.

Deno Queues are built on `Deno.Kv.enqueue()` and `Deno.Kv.listenQueue()`. The
Deno docs describe queue delivery as at-least-once, so consumer handlers must be
idempotent: use event IDs, natural keys, or database constraints to avoid
applying side effects twice.

```ts
import { Box } from "@catniplabs/box";

@Box.Event({ name: "orders.created" })
class OrderCreatedEvent extends Box.Event<{ orderId: string }> {}

@Box.Producer({ event: OrderCreatedEvent })
class OrderCreatedProducer extends Box.Producer<OrderCreatedEvent> {}

@Box.Service({ deps: [OrderCreatedProducer] })
class OrdersService {
  public constructor(private readonly producer: OrderCreatedProducer) {}

  public async create(orderId: string): Promise<void> {
    await this.producer.publish({ orderId }, {
      delay: 0,
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

  public async handle(event: OrderCreatedEvent): Promise<void> {
    // Keep this idempotent: Deno Queues provide at-least-once delivery.
    await saveOrderProjection(event.payload.orderId, event.id);
  }
}

const kv = await Deno.openKv();
const app = Box.createApp({
  services: [OrdersService],
  producers: [OrderCreatedProducer],
  consumers: [OrderCreatedConsumer],
  controllers: [OrdersController],
  queues: Box.denoQueues({ kv }),
});
```

## Dependency boundaries

Messaging resources have explicit DI boundaries:

- producers may inject services only;
- consumers may inject services only;
- services may inject services, repositories, or producers;
- controllers still inject services only.

This keeps HTTP handlers thin while allowing application services to publish
messages without depending on Deno KV directly.

## Queue options

`producer.publish(payload, options)` forwards Deno queue options:

- `delay` schedules future delivery in milliseconds;
- `backoffSchedule` controls retry delays after failed consumer handling;
- `keysIfUndelivered` stores undelivered messages at Deno KV keys after retries
  are exhausted.

BOX wraps queued values in a stable envelope with the event name, ID,
`occurredAt`, payload, and envelope version. One Deno KV queue listener
dispatches envelopes to consumers by event name.

## Local run

Deno Queues are currently documented by Deno as an unstable API. Depending on
the Deno version, local KV queue examples may require the unstable KV flag:

```bash
deno run --unstable-kv --allow-net examples/messaging/main.ts
```

Deployment support differs between Deno Deploy generations. Keep producers and
consumers idempotent and avoid coupling business code to Deno-specific queue
objects; BOX only exposes Deno Queues through `Box.denoQueues({ kv })`.
