import type { ControllerBase } from "./controller-base.ts";
import type { ControllerDecoratorFunction } from "./controller-decorator-function.type.ts";
import type { ControllerDecoratorOptions } from "./controller-decorator-options.interface.ts";

export type ControllerDecorator = {
  (
    path?: string,
    options?: ControllerDecoratorOptions,
  ): ControllerDecoratorFunction;
  (options: ControllerDecoratorOptions): ControllerDecoratorFunction;
  new (): ControllerBase;
  readonly prototype: ControllerBase;
};
