import type { AnyEventConstructor } from "./any-event-constructor.type.ts";
import type { EnqueueOptions } from "./enqueue-options.interface.ts";

export interface ProducerMetadata {
  readonly defaultOptions: EnqueueOptions;
  readonly event: AnyEventConstructor;
}
