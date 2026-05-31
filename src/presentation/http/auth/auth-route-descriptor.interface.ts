import type { HttpMethod } from "../types.ts";

export interface AuthRouteDescriptor {
  readonly method: HttpMethod;
  readonly path: string;
  readonly operationId?: string;
  readonly controller?: string;
}
