import { methodNotAllowed, notFound } from "./errors.ts";
import type { Handler, HttpMethod, Params } from "./types.ts";

export interface RouteMatch {
  handler: Handler;
  params: Params;
}

export interface RouterMiss {
  error: Error;
  allowedMethods?: string[];
}

interface Route {
  method: HttpMethod;
  path: string;
  pattern: RegExp;
  paramNames: string[];
  handler: Handler;
}

const PATH_PARAM_PATTERN = /^:([A-Za-z_][A-Za-z0-9_]*)$/;

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

export function normalizePath(path: string): string {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }

  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }

  return path;
}

function compilePath(path: string): { pattern: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];
  const segments = path.split("/").filter(Boolean);

  if (segments.length === 0) {
    return { pattern: /^\/$/, paramNames };
  }

  const pattern = segments.map((segment) => {
    const paramMatch = PATH_PARAM_PATTERN.exec(segment);

    if (paramMatch) {
      paramNames.push(paramMatch[1]);
      return "([^/]+)";
    }

    return escapeRegex(segment);
  }).join("/");

  return { pattern: new RegExp(`^/${pattern}$`), paramNames };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
