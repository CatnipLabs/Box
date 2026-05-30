import { methodNotAllowed, notFound } from "../errors.ts";
import type { Handler, HttpMethod, Params } from "../types.ts";
import { compilePath } from "./compile-path.util.ts";
import type { Route } from "./route.interface.ts";
import type { RouteMatch } from "./route-match.interface.ts";
import type { RouterMiss } from "./router-miss.interface.ts";
import { normalizePath } from "./normalize-path.util.ts";

export class Router {
  private readonly routes: Route[] = [];

  public add(method: HttpMethod, path: string, handler: Handler): this {
    const normalizedPath = normalizePath(path);
    const { pattern, paramNames } = compilePath(normalizedPath);

    this.routes.push({
      method,
      path: normalizedPath,
      pattern,
      paramNames,
      handler,
    });

    return this;
  }

  public match(method: string, pathname: string): RouteMatch | RouterMiss {
    const normalizedMethod = method.toUpperCase();
    const normalizedPath = normalizePath(pathname);
    const allowedMethods = new Set<string>();

    for (const route of this.routes) {
      const match = route.pattern.exec(normalizedPath);

      if (!match) continue;

      if (route.method !== normalizedMethod) {
        allowedMethods.add(route.method);
        continue;
      }

      const params: Params = {};
      route.paramNames.forEach((name, index) => {
        params[name] = decodeURIComponent(match[index + 1]);
      });

      return { handler: route.handler, params };
    }

    if (allowedMethods.size > 0) {
      return {
        error: methodNotAllowed(),
        allowedMethods: [...allowedMethods].sort(),
      };
    }

    return { error: notFound() };
  }
}
