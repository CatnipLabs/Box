import type { InjectionToken } from "../../../core/di/index.ts";
import type { AuthStrategyContract } from "./auth-strategy-contract.interface.ts";
import type { AuthStrategyDecoratorOptions } from "./auth-strategy-decorator-options.interface.ts";

export interface AuthStrategyMetadata {
  readonly name?: string;
}

const authStrategyMetadata = new WeakMap<
  InjectionToken<AuthStrategyContract>,
  AuthStrategyMetadata
>();

export function markAuthStrategy(
  target: InjectionToken<AuthStrategyContract>,
  options: AuthStrategyDecoratorOptions = {},
): void {
  authStrategyMetadata.set(target, { name: options.name });
}

export function getAuthStrategyMetadata(
  target: InjectionToken<AuthStrategyContract>,
): AuthStrategyMetadata | undefined {
  return authStrategyMetadata.get(target);
}
