import { markInjectable } from "../../core/di/index.ts";
import type { InjectionToken } from "../../core/di/index.ts";
import { ConsumerBase } from "./consumer-base.ts";
import type { ConsumerDecorator } from "./consumer-decorator.type.ts";
import { markConsumer } from "./consumer-metadata-store.ts";
import type { ConsumerOptions } from "./consumer-options.interface.ts";

function createConsumerDecorator(options: ConsumerOptions) {
  return (
    target: InjectionToken,
    context: ClassDecoratorContext,
  ): void => {
    if (context.kind !== "class") {
      throw new TypeError("@Consumer can only decorate classes");
    }

    markInjectable(target, "consumer", options);
    markConsumer(target, options);
  };
}

function ConsumerRuntime(
  this: ConsumerBase | undefined,
  options?: ConsumerOptions,
) {
  if (new.target) return;
  if (!options) throw new TypeError("@Consumer requires options");

  return createConsumerDecorator(options);
}

ConsumerRuntime.prototype = ConsumerBase.prototype;
Object.defineProperty(ConsumerRuntime, "name", { value: "Consumer" });
Object.defineProperty(ConsumerRuntime.prototype, "constructor", {
  configurable: true,
  value: ConsumerRuntime,
  writable: true,
});
Object.setPrototypeOf(ConsumerRuntime, ConsumerBase);

export const Consumer = ConsumerRuntime as unknown as ConsumerDecorator;
