import type { AuthRequirement } from "../http/auth/index.ts";
import type { ControllerTarget } from "./controller-target.type.ts";

const controllerAuth = new WeakMap<ControllerTarget, AuthRequirement>();
const routeAuth = new WeakMap<object, Map<PropertyKey, AuthRequirement>>();

export function setControllerAuth(
  target: ControllerTarget,
  requirement: AuthRequirement,
): void {
  controllerAuth.set(target, requirement);
}

export function getControllerAuth(
  target: ControllerTarget,
): AuthRequirement | undefined {
  return controllerAuth.get(target);
}

export function setRouteAuth(
  controller: object,
  propertyKey: PropertyKey,
  requirement: AuthRequirement,
): void {
  const requirements = routeAuth.get(controller) ?? new Map();
  requirements.set(propertyKey, requirement);
  routeAuth.set(controller, requirements);
}

export function getRouteAuth(
  controller: object,
  propertyKey: PropertyKey,
): AuthRequirement | undefined {
  return routeAuth.get(controller)?.get(propertyKey);
}
