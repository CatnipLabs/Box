import { markInjectable } from "../../core/di/index.ts";
import { ControllerBase } from "./controller-base.ts";
import type { ControllerDecoratorOptions } from "./controller-decorator-options.interface.ts";
import type { ControllerDecorator } from "./controller-decorator.type.ts";
import type { ControllerTarget } from "./controller-target.type.ts";
import { setControllerPath } from "./controller-metadata-store.ts";

function createControllerDecorator(
  path?: string,
  options?: ControllerDecoratorOptions,
) {
  return (target: ControllerTarget, context: ClassDecoratorContext): void => {
    if (context.kind !== "class") {
      throw new TypeError("@Controller can only decorate classes");
    }

    markInjectable(target, "controller", options);
    setControllerPath(target, path);
  };
}

function ControllerRuntime(
  this: ControllerBase | undefined,
  pathOrOptions?: string | ControllerDecoratorOptions,
  options?: ControllerDecoratorOptions,
) {
  if (new.target) {
    Object.defineProperty(this, "path", {
      configurable: true,
      enumerable: true,
      value: "/",
      writable: false,
    });
    return;
  }

  if (typeof pathOrOptions === "object") {
    return createControllerDecorator(pathOrOptions.path, pathOrOptions);
  }

  return createControllerDecorator(pathOrOptions, options);
}

ControllerRuntime.prototype = ControllerBase.prototype;
Object.setPrototypeOf(ControllerRuntime, ControllerBase);

export const Controller = ControllerRuntime as unknown as ControllerDecorator;
