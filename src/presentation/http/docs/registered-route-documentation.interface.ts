import type { HttpMethod } from "../types.ts";
import type { RouteOptions } from "./route-options.interface.ts";

export interface RegisteredRouteDocumentation {
  readonly method: HttpMethod;
  readonly path: string;
  readonly options: RouteOptions;
}
