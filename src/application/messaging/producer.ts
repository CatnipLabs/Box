import { markInjectable } from "../../core/di/index.ts";
import type { InjectionToken } from "../../core/di/index.ts";
import { ProducerBase } from "./producer-base.ts";
import type { ProducerDecorator } from "./producer-decorator.type.ts";
import { markProducer } from "./producer-metadata-store.ts";
import type { ProducerOptions } from "./producer-options.interface.ts";

function createProducerDecorator(options: ProducerOptions) {
  return (
    target: InjectionToken,
    context: ClassDecoratorContext,
  ): void => {
    if (context.kind !== "class") {
      throw new TypeError("@Producer can only decorate classes");
    }

    markInjectable(target, "producer", options);
    markProducer(target, options);
  };
}

function ProducerRuntime(
  this: ProducerBase | undefined,
  options?: ProducerOptions,
) {
  if (new.target) return;
  if (!options) throw new TypeError("@Producer requires options");

  return createProducerDecorator(options);
}

ProducerRuntime.prototype = ProducerBase.prototype;
Object.defineProperty(ProducerRuntime, "name", { value: "Producer" });
Object.defineProperty(ProducerRuntime.prototype, "constructor", {
  configurable: true,
  value: ProducerRuntime,
  writable: true,
});
Object.setPrototypeOf(ProducerRuntime, ProducerBase);

export const Producer = ProducerRuntime as unknown as ProducerDecorator;
