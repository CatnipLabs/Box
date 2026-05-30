import type { AuthStrategyContract } from "./auth/index.ts";
import type { InjectionToken, Provider } from "../../core/di/index.ts";
import type { AppOptions } from "./docs/index.ts";

export interface CreateAppOptions extends AppOptions {
  readonly authStrategies?: readonly InjectionToken<AuthStrategyContract>[];
  readonly controllers: readonly InjectionToken<object>[];
  readonly providers?: readonly Provider[];
  readonly repositories?: readonly InjectionToken[];
  readonly services?: readonly InjectionToken[];
}
