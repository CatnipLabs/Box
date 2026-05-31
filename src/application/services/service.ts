import { markInjectable } from "../../core/di/index.ts";
import type { InjectableOptions, InjectionToken } from "../../core/di/index.ts";
import { ServiceBase } from "./service-base.ts";
import type { ServiceDecorator } from "./service-decorator.type.ts";

function createServiceDecorator(options?: InjectableOptions) {
  return (
    target: InjectionToken,
    context: ClassDecoratorContext,
  ): void => {
    if (context.kind !== "class") {
      throw new TypeError("@Service can only decorate classes");
    }

    markInjectable(target, "service", options);
  };
}

function ServiceRuntime(
  this: ServiceBase | undefined,
  options?: InjectableOptions,
) {
  if (new.target) return;

  return createServiceDecorator(options);
}

ServiceRuntime.prototype = ServiceBase.prototype;
Object.defineProperty(ServiceRuntime, "name", { value: "Service" });
Object.defineProperty(ServiceRuntime.prototype, "constructor", {
  configurable: true,
  value: ServiceRuntime,
  writable: true,
});
Object.setPrototypeOf(ServiceRuntime, ServiceBase);

export const Service = ServiceRuntime as unknown as ServiceDecorator;
