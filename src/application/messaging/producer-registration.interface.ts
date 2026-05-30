import type { EnqueueOptions } from "./enqueue-options.interface.ts";
import type { AnyEventConstructor } from "./any-event-constructor.type.ts";
import type { ProducerBase } from "./producer-base.ts";

export interface ProducerRegistration {
  readonly defaultOptions: EnqueueOptions;
  readonly event: AnyEventConstructor;
  readonly instance: ProducerBase;
}
