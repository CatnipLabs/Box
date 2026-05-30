import type { InjectionToken } from "../../../core/di/index.ts";
import type { AuthStrategyContract } from "./auth-strategy-contract.interface.ts";
import type { AuthStrategyDecoratorOptions } from "./auth-strategy-decorator-options.interface.ts";

export type AuthStrategyDecorator = (
  options?: AuthStrategyDecoratorOptions,
) => (
  target: InjectionToken<AuthStrategyContract>,
  context: ClassDecoratorContext,
) => void;
