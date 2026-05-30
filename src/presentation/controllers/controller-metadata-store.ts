import type { HttpMethod } from "../http/types.ts";
import type { ControllerMetadata } from "./controller-metadata.interface.ts";
import type { ControllerTarget } from "./controller-target.type.ts";
import type { DecoratedRouteDefinition } from "./decorated-route-definition.interface.ts";
import type { RouteDefinition } from "./route-definition.interface.ts";

const controllerMetadata = new WeakMap<ControllerTarget, ControllerMetadata>();
const decoratedRoutes = new WeakMap<object, DecoratedRouteDefinition[]>();

export function setControllerPath(
  target: ControllerTarget,
  path?: string,
): void {
  controllerMetadata.set(target, { path });
}

export function getControllerPath(controller: object): string {
  const constructor = controller.constructor as ControllerTarget;
  const explicitPath = controllerMetadata.get(constructor)?.path;

  if (explicitPath !== undefined) return normalizeControllerPath(explicitPath);

  if (hasStringProperty(controller, "path")) {
    return normalizeControllerPath(controller.path);
  }

  return inferControllerPath(constructor.name);
}

export function addDecoratedRoute(
  controller: object,
  route: DecoratedRouteDefinition,
): void {
  const routes = decoratedRoutes.get(controller) ?? [];

  if (!routes.some((candidate) => sameRoute(candidate, route))) {
    routes.push(route);
    decoratedRoutes.set(controller, routes);
  }
}

export function getControllerRoutes(controller: object): RouteDefinition[] {
  const decorated = decoratedRoutes.get(controller);

  if (decorated && decorated.length > 0) {
    return decorated.map(({ method, path, handler, options }) => ({
      method,
      path,
      handler,
      options,
    }));
  }

  if (hasRoutesMethod(controller)) return controller.routes();

  return [];
}

function hasStringProperty<T extends string>(
  value: object,
  property: T,
): value is object & Record<T, string> {
  return property in value &&
    typeof value[property as keyof typeof value] === "string";
}

function hasRoutesMethod(
  value: object,
): value is { routes(): RouteDefinition[] } {
  return "routes" in value && typeof value.routes === "function";
}

function normalizeControllerPath(path: string): string {
  if (path === "") return "/";
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

function inferControllerPath(className: string): string {
  const name = className.replace(/Controller$/, "") || className;
  const kebab = name
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();

  return normalizeControllerPath(kebab);
}

function sameRoute(
  left: DecoratedRouteDefinition,
  right: DecoratedRouteDefinition,
): boolean {
  return left.method === right.method && left.path === right.path &&
    left.propertyKey === right.propertyKey;
}

export function createDecoratedRoute(
  method: HttpMethod,
  path: string,
  propertyKey: PropertyKey,
  handler: RouteDefinition["handler"],
  options: RouteDefinition["options"],
): DecoratedRouteDefinition {
  return { method, path, propertyKey, handler, options };
}
