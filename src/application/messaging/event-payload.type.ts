import type { EventBase } from "./event-base.ts";

export type EventPayload<TEvent extends EventBase> = TEvent extends
  EventBase<infer TPayload> ? TPayload : never;
