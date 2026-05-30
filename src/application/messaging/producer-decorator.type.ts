import type { InjectionToken } from "../../core/di/index.ts";
import type { EventBase } from "./event-base.ts";
import type { ProducerBase } from "./producer-base.ts";
import type { ProducerOptions } from "./producer-options.interface.ts";

export type ProducerDecorator = {
  new <TEvent extends EventBase = EventBase>(): ProducerBase<TEvent>;
  <TEvent extends EventBase = EventBase>(options: ProducerOptions<TEvent>): (
    target: InjectionToken,
    context: ClassDecoratorContext,
  ) => void;
};
