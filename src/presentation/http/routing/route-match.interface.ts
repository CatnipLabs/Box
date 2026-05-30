import type { Handler, Params } from "../types.ts";

export interface RouteMatch {
  handler: Handler;
  params: Params;
}
