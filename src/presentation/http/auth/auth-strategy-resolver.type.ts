import type { AuthRequirement } from "./auth-requirement.type.ts";
import type { AuthRouteDescriptor } from "./auth-route-descriptor.interface.ts";
import type { AuthStrategyContract } from "./auth-strategy-contract.interface.ts";

export type AuthStrategyResolver = (
  requirement: AuthRequirement,
  route: AuthRouteDescriptor,
) => AuthStrategyContract;
