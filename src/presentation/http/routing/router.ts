import { badRequest, methodNotAllowed, notFound } from "../errors.ts";
import type { Handler, HttpMethod, Params } from "../types.ts";
import { compilePath } from "./compile-path.util.ts";
import type { Route } from "./route.interface.ts";
import type { RouteMatch } from "./route-match.interface.ts";
import type { RouterMiss } from "./router-miss.interface.ts";
import { normalizePath } from "./normalize-path.util.ts";

export class Router {
  private readonly routes: Route[] = [];
  private readonly staticRoutes = new Map<string, Map<string, Route>>();
  private readonly parameterRoutes = new Map<string, Route[]>();
  private readonly wildcardParameterRoutes: Route[] = [];

  public add(method: HttpMethod, path: string, handler: Handler): this {
    const normalizedPath = normalizePath(path);
    const { pattern, paramNames } = compilePath(normalizedPath);
    const route: Route = {
      method,
      path: normalizedPath,
      pattern,
      paramNames,
      handler,
    };

    this.routes.push(route);

    if (paramNames.length === 0) {
      const routesByMethod = this.staticRoutes.get(normalizedPath) ??
        new Map<string, Route>();
      routesByMethod.set(method, route);
      this.staticRoutes.set(normalizedPath, routesByMethod);
      return this;
    }

    const firstSegment = firstPathSegment(normalizedPath);
    if (firstSegment?.startsWith(":")) {
      this.wildcardParameterRoutes.push(route);
      return this;
    }

    const bucketKey = firstSegment ?? "/";
    const bucket = this.parameterRoutes.get(bucketKey) ?? [];
    bucket.push(route);
    this.parameterRoutes.set(bucketKey, bucket);

    return this;
  }

  public match(method: string, pathname: string): RouteMatch | RouterMiss {
    const normalizedMethod = method.toUpperCase();
    const normalizedPath = normalizePath(pathname);
    const allowedMethods = new Set<string>();

    const staticRoutes = this.staticRoutes.get(normalizedPath);
    if (staticRoutes) {
      const route = staticRoutes.get(normalizedMethod);
      if (route) return { handler: route.handler, params: {} };

      for (const allowedMethod of staticRoutes.keys()) {
        allowedMethods.add(allowedMethod);
      }
    }

    const candidates = this.parameterCandidates(normalizedPath);
    for (const route of candidates) {
      const match = route.pattern.exec(normalizedPath);

      if (!match) continue;

      if (route.method !== normalizedMethod) {
        allowedMethods.add(route.method);
        continue;
      }

      return { handler: route.handler, params: decodeParams(route, match) };
    }

    if (allowedMethods.size > 0) {
      return {
        error: methodNotAllowed(),
        allowedMethods: [...allowedMethods].sort(),
      };
    }

    return { error: notFound() };
  }

  private parameterCandidates(pathname: string): Route[] {
    const firstSegment = firstPathSegment(pathname) ?? "/";
    const bucket = this.parameterRoutes.get(firstSegment) ?? [];
    if (this.wildcardParameterRoutes.length === 0) return bucket;
    if (bucket.length === 0) return this.wildcardParameterRoutes;
    return [...bucket, ...this.wildcardParameterRoutes];
  }
}

function decodeParams(route: Route, match: RegExpExecArray): Params {
  const params: Params = {};

  route.paramNames.forEach((name, index) => {
    try {
      params[name] = decodeURIComponent(match[index + 1]);
    } catch (_error) {
      throw badRequest("Malformed URL path parameter");
    }
  });

  return params;
}

function firstPathSegment(pathname: string): string | undefined {
  return pathname.split("/").filter(Boolean)[0];
}
