import { assert, assertEquals, assertRejects, assertThrows } from "@std/assert";
import {
  Consumer,
  Event,
  Producer,
} from "../../../src/application/messaging/index.ts";
import {
  DenoQueueRuntime,
  denoQueues,
} from "../../../src/infra/messaging/deno-queues/index.ts";
import { FakeKvQueue } from "../../fixtures/messaging/fake_kv_queue.ts";

@Event({ name: "orders.created" })
class OrderCreatedEvent extends Event<{ orderId: string }> {
  public static readonly eventName = "orders.created";
}

@Event({ name: "orders.cancelled" })
class OrderCancelledEvent extends Event<{ orderId: string }> {
  public static readonly eventName = "orders.cancelled";
}

@Producer({ event: OrderCreatedEvent })
class OrderCreatedProducer extends Producer<OrderCreatedEvent> {
  public static readonly testOnly = true;
}
class RecordingConsumer extends Consumer<OrderCreatedEvent> {
  public readonly handled: OrderCreatedEvent[] = [];

  public handle(event: OrderCreatedEvent): void {
    this.handled.push(event);
  }
}

class ThrowingConsumer extends Consumer<OrderCreatedEvent> {
  public handle(_event: OrderCreatedEvent): void {
    throw new Error("consumer failed");
  }
}

Deno.test("Deno Queues runtime: producer enqueues a versioned BOX envelope with options", async () => {
  const kv = new FakeKvQueue();
  const producer = new OrderCreatedProducer();
  const runtime = new DenoQueueRuntime(denoQueues({ kv }));

  runtime.bindProducers([{
    defaultOptions: {},
    event: OrderCreatedEvent,
    instance: producer,
  }], []);
  await producer.publish({ orderId: "ord-1" }, {
    backoffSchedule: [1_000, 5_000],
    delay: 250,
    keysIfUndelivered: [["failed", "ord-1"]],
  });

  assertEquals(kv.enqueued.length, 1);
  const envelope = kv.enqueued[0].value as Record<string, unknown>;
  assert(typeof envelope.id === "string");
  assert(envelope.id.length > 0);
  assert(typeof envelope.occurredAt === "string");
  assert(!Number.isNaN(Date.parse(envelope.occurredAt)));
  assertEquals(envelope.__boxQueue, true);
  assertEquals(envelope.version, 1);
  assertEquals(envelope.event, "orders.created");
  assertEquals(envelope.payload, { orderId: "ord-1" });
  assertEquals(kv.enqueued[0].options, {
    backoffSchedule: [1_000, 5_000],
    delay: 250,
    keysIfUndelivered: [["failed", "ord-1"]],
  });
});

Deno.test("Deno Queues runtime: listener routes matching envelopes to consumers", async () => {
  const kv = new FakeKvQueue();
  const consumer = new RecordingConsumer();
  const runtime = new DenoQueueRuntime(denoQueues({ kv }));

  runtime.bindProducers([], [{ event: OrderCreatedEvent, instance: consumer }]);
  await kv.deliver({
    __boxQueue: true,
    version: 1,
    event: "orders.created",
    id: "evt-1",
    occurredAt: "2026-05-30T20:00:00.000Z",
    payload: { orderId: "ord-2" },
  });

  assertEquals(consumer.handled.length, 1);
  assertEquals(consumer.handled[0] instanceof OrderCreatedEvent, true);
  assertEquals(consumer.handled[0].payload, { orderId: "ord-2" });
  assertEquals(consumer.handled[0].id, "evt-1");
});

Deno.test("Deno Queues runtime: listener ignores unknown queue values and events", async () => {
  const kv = new FakeKvQueue();
  const consumer = new RecordingConsumer();
  const runtime = new DenoQueueRuntime(denoQueues({ kv }));

  runtime.bindProducers([], [{ event: OrderCreatedEvent, instance: consumer }]);
  await kv.deliver({ not: "a box envelope" });
  await kv.deliver({
    __boxQueue: true,
    version: 1,
    event: "orders.cancelled",
    id: "evt-2",
    occurredAt: "2026-05-30T20:00:00.000Z",
    payload: { orderId: "ord-3" },
  });

  assertEquals(consumer.handled.length, 0);
  assertEquals(
    new OrderCancelledEvent({ orderId: "ord-3" }).payload.orderId,
    "ord-3",
  );
});

Deno.test("Deno Queues runtime: duplicate event names must use the same event class", () => {
  @Event({ name: "orders.created" })
  class DuplicateOrderCreatedEvent extends Event<{ orderId: string }> {
    public static readonly eventName = "orders.created";
  }

  const runtime = new DenoQueueRuntime(denoQueues({
    kv: new FakeKvQueue(),
    listen: false,
  }));

  assertThrows(
    () =>
      runtime.bindProducers([], [
        { event: OrderCreatedEvent, instance: new RecordingConsumer() },
        {
          event: DuplicateOrderCreatedEvent,
          instance: new RecordingConsumer(),
        },
      ]),
    TypeError,
    'Duplicate queue event name "orders.created" registered with different event classes',
  );
});

Deno.test("Deno Queues runtime: consumer failures propagate for Deno retry", async () => {
  const kv = new FakeKvQueue();
  const runtime = new DenoQueueRuntime(denoQueues({ kv }));

  runtime.bindProducers([], [{
    event: OrderCreatedEvent,
    instance: new ThrowingConsumer(),
  }]);

  await assertRejects(
    () =>
      kv.deliver({
        __boxQueue: true,
        version: 1,
        event: "orders.created",
        id: "evt-3",
        occurredAt: "2026-05-30T20:00:00.000Z",
        payload: { orderId: "ord-4" },
      }),
    Error,
    "consumer failed",
  );
});
