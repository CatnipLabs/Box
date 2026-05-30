import type { InjectableOptions, InjectionToken } from "../../core/di/index.ts";
import type { ServiceBase } from "./service-base.ts";

export type ServiceDecorator = {
  new (): ServiceBase;
  (options?: InjectableOptions): (
    target: InjectionToken,
    context: ClassDecoratorContext,
  ) => void;
};
