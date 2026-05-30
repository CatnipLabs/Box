import type { ZodTypeAny } from "zod";

export interface RouteResponseContract {
  readonly description?: string;
  readonly body?: ZodTypeAny;
  readonly contentType?: string;
}
