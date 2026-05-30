import type { Context, MaybePromise } from "../types.ts";
import type { AuthStrategyResult } from "./auth-strategy-result.type.ts";

export interface AuthStrategyContract {
  validate(ctx: Context): MaybePromise<AuthStrategyResult>;
}
