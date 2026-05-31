import { HttpError } from "../errors.ts";
import { HttpStatus } from "../http-status.enum.ts";
import type { Context } from "../types.ts";
import type { AuthStrategyContract } from "./auth-strategy-contract.interface.ts";

export async function runAuthStrategy(
  strategy: AuthStrategyContract,
  ctx: Context,
): Promise<Response | undefined> {
  const result = await strategy.validate(ctx);

  if (result instanceof Response) return result;

  if (result === false) {
    throw new HttpError(
      HttpStatus.UNAUTHORIZED,
      "Unauthorized",
      "unauthorized",
    );
  }

  return undefined;
}
