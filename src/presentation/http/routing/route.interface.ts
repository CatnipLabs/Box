import type { Handler, HttpMethod } from "../types.ts";

export interface Route {
  method: HttpMethod;
  path: string;
  pattern: RegExp;
  paramNames: string[];
  handler: Handler;
}
