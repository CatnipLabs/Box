import { z } from "zod";
import type { HttpMethod } from "../http/types.ts";
import { getControllerAuth, getRouteAuth } from "./auth-metadata-store.ts";
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

export function getControllerTag(controller: object): string {
  return inferControllerTag((controller.constructor as ControllerTarget).name);
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
    return decorated.map(({ method, path, handler, options, propertyKey }) => ({
      method,
      path,
      handler,
      options: enrichRouteOptions(controller, path, options, propertyKey),
    }));
  }

  if (hasRoutesMethod(controller)) {
    return controller.routes().map(({ method, path, handler, options }) => ({
      method,
      path,
      handler,
      options: enrichRouteOptions(controller, path, options),
    }));
  }

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
  const name = stripControllerSuffix(className);
  return normalizeControllerPath(toKebabCase(name));
}

function stripControllerSuffix(className: string): string {
  const suffix = "Controller";
  if (!className.endsWith(suffix)) return className;

  return className.slice(0, -suffix.length) || className;
}

function toKebabCase(value: string): string {
  const kebab: string[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const current = value[index];
    const previous = value[index - 1];
    const next = value[index + 1];

    if (
      index > 0 && isAsciiUppercase(current) &&
      (isAsciiLowercaseOrDigit(previous) ||
        (isAsciiUppercase(previous) && isAsciiLowercase(next)))
    ) {
      kebab.push("-");
    }

    kebab.push(current);
  }

  return kebab.join("").toLowerCase();
}

function isAsciiUppercase(value: string | undefined): boolean {
  if (value === undefined) return false;

  const code = value.codePointAt(0) ?? 0;
  return code >= 65 && code <= 90;
}

function isAsciiLowercaseOrDigit(value: string | undefined): boolean {
  if (value === undefined) return false;

  const code = value.codePointAt(0) ?? 0;
  return (code >= 97 && code <= 122) || (code >= 48 && code <= 57);
}

function isAsciiLowercase(value: string | undefined): boolean {
  if (value === undefined) return false;

  const code = value.codePointAt(0) ?? 0;
  return code >= 97 && code <= 122;
}

function inferControllerTag(className: string): string {
  return stripControllerSuffix(className);
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

function enrichRouteOptions(
  controller: object,
  path: string,
  options: RouteDefinition["options"],
  propertyKey?: PropertyKey,
): RouteDefinition["options"] {
  const params = inferParamsSchema(path);
  const request = params && !options?.request?.params
    ? { ...options?.request, params }
    : options?.request;
  const constructor = controller.constructor as ControllerTarget;
  const auth = propertyKey === undefined
    ? options?.auth ?? getControllerAuth(constructor)
    : getRouteAuth(controller, propertyKey) ?? options?.auth ??
      getControllerAuth(constructor);

  return {
    ...options,
    auth,
    operationId: options?.operationId ?? propertyKey?.toString(),
    request,
    tags: options?.tags ?? [getControllerTag(controller)],
  };
}

function inferParamsSchema(
  path: string,
): z.ZodObject<Record<string, z.ZodString>> | undefined {
  const entries = [...path.matchAll(/:(\w+)/g)].map((match) =>
    [
      match[1],
      z.string(),
    ] as const
  );

  if (entries.length === 0) return undefined;

  return z.object(Object.fromEntries(entries) as Record<string, z.ZodString>);
}
