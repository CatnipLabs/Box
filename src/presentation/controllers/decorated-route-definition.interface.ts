import type { RouteDefinition } from "./route-definition.interface.ts";

export interface DecoratedRouteDefinition extends RouteDefinition {
  readonly propertyKey: PropertyKey;
}
