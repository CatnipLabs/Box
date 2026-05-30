import { assert, assertEquals, assertThrows } from "@std/assert";
import { getInjectableMetadata } from "../../../src/core/di/index.ts";
import {
  Consumer,
  Event,
  getConsumerMetadata,
  getEventMetadata,
  getProducerMetadata,
  Producer,
} from "../../../src/application/messaging/index.ts";

@Event({ name: "orders.created" })
class OrderCreatedEvent extends Event<{ orderId: string }> {}

@Producer({ event: OrderCreatedEvent })
class OrderCreatedProducer extends Producer<OrderCreatedEvent> {}

@Consumer({ event: OrderCreatedEvent })
class OrderCreatedConsumer extends Consumer<OrderCreatedEvent> {
  public handle(_event: OrderCreatedEvent): void {}
}

Deno.test("Messaging metadata: Event stores stable name and event defaults", () => {
  const event = new OrderCreatedEvent({ orderId: "ord-1" });

  assertEquals(getEventMetadata(OrderCreatedEvent)?.name, "orders.created");
  assertEquals(event.payload, { orderId: "ord-1" });
  assert(typeof event.id === "string");
  assert(event.id.length > 0);
  assert(event.occurredAt instanceof Date);
});

Deno.test("Messaging metadata: Producer and Consumer store event bindings and injectable kinds", () => {
  assertEquals(
    getProducerMetadata(OrderCreatedProducer)?.event,
    OrderCreatedEvent,
  );
  assertEquals(
    getConsumerMetadata(OrderCreatedConsumer)?.event,
    OrderCreatedEvent,
  );
  assertEquals(getInjectableMetadata(OrderCreatedProducer)?.kind, "producer");
  assertEquals(getInjectableMetadata(OrderCreatedConsumer)?.kind, "consumer");
});

Deno.test("Messaging metadata: decorators reject blank event names", () => {
  assertThrows(
    () =>
      Event({ name: "   " })(
        class BlankEvent {},
        { kind: "class", name: "BlankEvent" } as ClassDecoratorContext,
      ),
    TypeError,
    "Event name must be a non-empty string",
  );
});

Deno.test("Messaging metadata: Producer requires an @Event class", () => {
  class UndecoratedEvent extends Event<{ ok: boolean }> {}

  assertThrows(
    () =>
      Producer({ event: UndecoratedEvent })(
        class InvalidProducer {},
        { kind: "class", name: "InvalidProducer" } as ClassDecoratorContext,
      ),
    TypeError,
    "Producer event must be decorated with @Event",
  );
});

Deno.test("Messaging metadata: Consumer requires an @Event class", () => {
  class UndecoratedEvent extends Event<{ ok: boolean }> {}

  assertThrows(
    () =>
      Consumer({ event: UndecoratedEvent })(
        class InvalidConsumer {},
        { kind: "class", name: "InvalidConsumer" } as ClassDecoratorContext,
      ),
    TypeError,
    "Consumer event must be decorated with @Event",
  );
});
