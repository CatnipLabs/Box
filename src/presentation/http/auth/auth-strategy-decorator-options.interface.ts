import type { InjectableOptions } from "../../../core/di/index.ts";

export interface AuthStrategyDecoratorOptions extends InjectableOptions {
  readonly name?: string;
}
