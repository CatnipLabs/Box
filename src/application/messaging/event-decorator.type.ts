import type { InjectionToken } from "../../core/di/index.ts";
import type { EventBase } from "./event-base.ts";
import type { EventInstanceOptions } from "./event-instance-options.interface.ts";
import type { EventOptions } from "./event-options.interface.ts";

export type EventDecorator = {
  new <TPayload = unknown>(
    payload: TPayload,
    options?: EventInstanceOptions,
  ): EventBase<TPayload>;
  (options: EventOptions): (
    target: InjectionToken,
    context: ClassDecoratorContext,
  ) => void;
};
