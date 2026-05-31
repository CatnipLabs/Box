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
class OrderCreatedEvent extends Event<{ orderId: string }> {
  public static readonly eventName = "orders.created";
}

@Producer({ event: OrderCreatedEvent })
class OrderCreatedProducer extends Producer<OrderCreatedEvent> {
  public static readonly testOnly = true;
}
@Consumer({ event: OrderCreatedEvent })
class OrderCreatedConsumer extends Consumer<OrderCreatedEvent> {
  public handle(event: OrderCreatedEvent): void {
    assert(event instanceof OrderCreatedEvent);
  }
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
        class BlankEvent {
          public static readonly testOnly = true;
        },
        { kind: "class", name: "BlankEvent" } as ClassDecoratorContext,
      ),
    TypeError,
    "Event name must be a non-empty string",
  );
});

Deno.test("Messaging metadata: Producer requires an @Event class", () => {
  class UndecoratedEvent extends Event<{ ok: boolean }> {
    public static readonly eventName = "undecorated";
  }

  assertThrows(
    () =>
      Producer({ event: UndecoratedEvent })(
        class InvalidProducer {
          public static readonly testOnly = true;
        },
        { kind: "class", name: "InvalidProducer" } as ClassDecoratorContext,
      ),
    TypeError,
    "Producer event must be decorated with @Event",
  );
});

Deno.test("Messaging metadata: Consumer requires an @Event class", () => {
  class UndecoratedEvent extends Event<{ ok: boolean }> {
    public static readonly eventName = "undecorated";
  }

  assertThrows(
    () =>
      Consumer({ event: UndecoratedEvent })(
        class InvalidConsumer {
          public static readonly testOnly = true;
        },
        { kind: "class", name: "InvalidConsumer" } as ClassDecoratorContext,
      ),
    TypeError,
    "Consumer event must be decorated with @Event",
  );
});
