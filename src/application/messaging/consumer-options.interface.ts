import type { InjectableOptions } from "../../core/di/index.ts";
import type { EventBase } from "./event-base.ts";
import type { EventConstructor } from "./event-constructor.type.ts";

export interface ConsumerOptions<TEvent extends EventBase = EventBase>
  extends InjectableOptions {
  readonly event: EventConstructor<TEvent>;
}
