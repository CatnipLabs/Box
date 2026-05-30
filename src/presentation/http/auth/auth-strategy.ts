import { markInjectable } from "../../../core/di/index.ts";
import type { InjectionToken } from "../../../core/di/index.ts";
import type { AuthStrategyContract } from "./auth-strategy-contract.interface.ts";
import type { AuthStrategyDecorator } from "./auth-strategy-decorator.type.ts";
import type { AuthStrategyDecoratorOptions } from "./auth-strategy-decorator-options.interface.ts";
import { markAuthStrategy } from "./auth-strategy-metadata-store.ts";

function createAuthStrategyDecorator(
  options?: AuthStrategyDecoratorOptions,
) {
  return (
    target: InjectionToken<AuthStrategyContract>,
    context: ClassDecoratorContext,
  ): void => {
    if (context.kind !== "class") {
      throw new TypeError("@AuthStrategy can only decorate classes");
    }

    markInjectable(target, "auth-strategy", options);
    markAuthStrategy(target, options);
  };
}

export const AuthStrategy =
  createAuthStrategyDecorator as AuthStrategyDecorator;
