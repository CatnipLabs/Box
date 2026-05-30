import type { AnyEventConstructor } from "./any-event-constructor.type.ts";

export interface ConsumerMetadata {
  readonly event: AnyEventConstructor;
}
