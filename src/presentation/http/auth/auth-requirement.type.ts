import type { InjectionToken } from "../../../core/di/index.ts";
import type { AuthStrategyContract } from "./auth-strategy-contract.interface.ts";

export type AuthRequirement =
  | true
  | string
  | InjectionToken<AuthStrategyContract>;
