import type { ConsumerBase } from "./consumer-base.ts";
import type { AnyEventConstructor } from "./any-event-constructor.type.ts";

export interface ConsumerRegistration {
  readonly event: AnyEventConstructor;
  readonly instance: ConsumerBase;
}
