import type { EventBase } from "./event-base.ts";
import type { EventInstanceOptions } from "./event-instance-options.interface.ts";

export type AnyEventConstructor = new (
  payload: never,
  options?: EventInstanceOptions,
) => EventBase;
