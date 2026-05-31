import type { InjectableOptions } from "../../core/di/index.ts";
import type { EnqueueOptions } from "./enqueue-options.interface.ts";
import type { EventBase } from "./event-base.ts";
import type { EventConstructor } from "./event-constructor.type.ts";

export interface ProducerOptions<TEvent extends EventBase = EventBase>
  extends InjectableOptions, EnqueueOptions {
  readonly event: EventConstructor<TEvent>;
}
