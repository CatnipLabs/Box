import type { ZodTypeAny } from "zod";

export interface RouteRequestContract {
  readonly params?: ZodTypeAny;
  readonly query?: ZodTypeAny;
  readonly headers?: ZodTypeAny;
  readonly body?: ZodTypeAny;
  readonly bodyMaxBytes?: number;
}
