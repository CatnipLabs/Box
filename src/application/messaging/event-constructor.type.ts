import type { EventBase } from "./event-base.ts";
import type { EventInstanceOptions } from "./event-instance-options.interface.ts";
import type { EventPayload } from "./event-payload.type.ts";

export type EventConstructor<TEvent extends EventBase = EventBase> = new (
  payload: EventPayload<TEvent>,
  options?: EventInstanceOptions,
) => TEvent;
