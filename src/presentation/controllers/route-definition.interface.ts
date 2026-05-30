import type { Handler, HttpMethod } from "../http/types.ts";

export interface RouteDefinition {
  method: HttpMethod;
  path: string;
  handler: Handler;
}
