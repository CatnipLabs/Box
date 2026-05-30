import type { Handler, HttpMethod } from "../http/types.ts";
import type { RouteDefinition } from "./route-definition.interface.ts";

export class Controller {
  public readonly path: string = "/";

  public routes(): RouteDefinition[] {
    return [];
  }

  protected route(
    method: HttpMethod,
    path: string,
    handler: Handler,
  ): RouteDefinition {
    return { method, path, handler };
  }

  protected get(path: string, handler: Handler): RouteDefinition {
    return this.route("GET", path, handler);
  }

  protected post(path: string, handler: Handler): RouteDefinition {
    return this.route("POST", path, handler);
  }

  protected put(path: string, handler: Handler): RouteDefinition {
    return this.route("PUT", path, handler);
  }

  protected patch(path: string, handler: Handler): RouteDefinition {
    return this.route("PATCH", path, handler);
  }

  protected delete(path: string, handler: Handler): RouteDefinition {
    return this.route("DELETE", path, handler);
  }

  protected options(path: string, handler: Handler): RouteDefinition {
    return this.route("OPTIONS", path, handler);
  }

  protected head(path: string, handler: Handler): RouteDefinition {
    return this.route("HEAD", path, handler);
  }
}
