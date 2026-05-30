import type { EventInstanceOptions } from "./event-instance-options.interface.ts";
import { EventBase } from "./event-base.ts";
import type { EventConstructor } from "./event-constructor.type.ts";
import type { EventDecorator } from "./event-decorator.type.ts";
import type { EventOptions } from "./event-options.interface.ts";
import { markEvent } from "./event-metadata-store.ts";

function createEventDecorator(options: EventOptions) {
  return (
    target: EventConstructor,
    context: ClassDecoratorContext,
  ): void => {
    if (context.kind !== "class") {
      throw new TypeError("@Event can only decorate classes");
    }

    markEvent(target as EventConstructor, options);
  };
}

function EventRuntime<TPayload = unknown>(
  this: EventBase<TPayload> | undefined,
  payloadOrOptions: TPayload | EventOptions,
  instanceOptions?: EventInstanceOptions,
) {
  if (new.target) {
    const occurredAt = instanceOptions?.occurredAt instanceof Date
      ? instanceOptions.occurredAt
      : new Date(instanceOptions?.occurredAt ?? Date.now());

    Object.defineProperties(this, {
      id: {
        configurable: true,
        enumerable: true,
        value: instanceOptions?.id ?? crypto.randomUUID(),
        writable: false,
      },
      occurredAt: {
        configurable: true,
        enumerable: true,
        value: occurredAt,
        writable: false,
      },
      payload: {
        configurable: true,
        enumerable: true,
        value: payloadOrOptions as TPayload,
        writable: false,
      },
    });
    return;
  }

  return createEventDecorator(payloadOrOptions as EventOptions);
}

EventRuntime.prototype = EventBase.prototype;
Object.defineProperty(EventRuntime, "name", { value: "Event" });
Object.defineProperty(EventRuntime.prototype, "constructor", {
  configurable: true,
  value: EventRuntime,
  writable: true,
});
Object.setPrototypeOf(EventRuntime, EventBase);

export const Event = EventRuntime as unknown as EventDecorator;
