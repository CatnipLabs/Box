import type { RouteRequestContract } from "./route-request-contract.interface.ts";
import type { RouteResponsesContract } from "./route-responses-contract.type.ts";

export interface RouteOptions {
  readonly summary?: string;
  readonly description?: string;
  readonly operationId?: string;
  readonly tags?: string[];
  readonly deprecated?: boolean;
  readonly docs?: boolean;
  readonly status?: number;
  readonly request?: RouteRequestContract;
  readonly responses?: RouteResponsesContract;
}
