import type { InjectionToken } from "../../core/di/index.ts";
import type { ConsumerBase } from "./consumer-base.ts";
import type { ConsumerOptions } from "./consumer-options.interface.ts";
import type { EventBase } from "./event-base.ts";

export type ConsumerDecorator = {
  new <TEvent extends EventBase = EventBase>(): ConsumerBase<TEvent>;
  <TEvent extends EventBase = EventBase>(options: ConsumerOptions<TEvent>): (
    target: InjectionToken,
    context: ClassDecoratorContext,
  ) => void;
};
