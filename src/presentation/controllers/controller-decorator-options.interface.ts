import type { InjectableOptions } from "../../core/di/index.ts";

export interface ControllerDecoratorOptions extends InjectableOptions {
  readonly path?: string;
}
