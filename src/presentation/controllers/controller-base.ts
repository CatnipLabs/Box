import type { RouteOptions } from "../http/docs/index.ts";
import type { Handler, HttpMethod } from "../http/types.ts";
import type { RouteDefinition } from "./route-definition.interface.ts";

export class ControllerBase {
  public readonly path: string = "/";

  public routes(): RouteDefinition[] {
    return [];
  }

  protected route(
    method: HttpMethod,
    path: string,
    handler: Handler,
    options?: RouteOptions,
  ): RouteDefinition {
    return { method, path, handler, options };
  }

  protected get(
    path: string,
    handler: Handler,
    options?: RouteOptions,
  ): RouteDefinition {
    return this.route("GET", path, handler, options);
  }

  protected post(
    path: string,
    handler: Handler,
    options?: RouteOptions,
  ): RouteDefinition {
    return this.route("POST", path, handler, options);
  }

  protected put(
    path: string,
    handler: Handler,
    options?: RouteOptions,
  ): RouteDefinition {
    return this.route("PUT", path, handler, options);
  }

  protected patch(
    path: string,
    handler: Handler,
    options?: RouteOptions,
  ): RouteDefinition {
    return this.route("PATCH", path, handler, options);
  }

  protected delete(
    path: string,
    handler: Handler,
    options?: RouteOptions,
  ): RouteDefinition {
    return this.route("DELETE", path, handler, options);
  }

  protected options(
    path: string,
    handler: Handler,
    options?: RouteOptions,
  ): RouteDefinition {
    return this.route("OPTIONS", path, handler, options);
  }

  protected head(
    path: string,
    handler: Handler,
    options?: RouteOptions,
  ): RouteDefinition {
    return this.route("HEAD", path, handler, options);
  }
}
