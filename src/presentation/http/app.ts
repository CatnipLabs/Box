import type { Controller } from "../controllers/index.ts";
import { createContext } from "./context/index.ts";
import { HttpError } from "./errors.ts";
import { compose } from "./middleware.ts";
import { Router } from "./router.ts";
import { json } from "./response.ts";
import { errorResponse } from "./responses/index.ts";
import type { Handler, HttpMethod, Middleware, State } from "./types.ts";
import { isCorsPreflight } from "./utils/is-cors-preflight.util.ts";
import { joinPaths } from "./utils/join-paths.util.ts";

export class App {
  private readonly router = new Router();
  private readonly middlewares: Middleware[] = [];

  public get(path: string, handler: Handler): this {
    return this.route("GET", path, handler);
  }

  public post(path: string, handler: Handler): this {
    return this.route("POST", path, handler);
  }

  public put(path: string, handler: Handler): this {
    return this.route("PUT", path, handler);
  }

  public patch(path: string, handler: Handler): this {
    return this.route("PATCH", path, handler);
  }

  public delete(path: string, handler: Handler): this {
    return this.route("DELETE", path, handler);
  }

  public options(path: string, handler: Handler): this {
    return this.route("OPTIONS", path, handler);
  }

  public head(path: string, handler: Handler): this {
    return this.route("HEAD", path, handler);
  }

  public use(middleware: Middleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  public route(method: HttpMethod, path: string, handler: Handler): this {
    this.router.add(method, path, handler);
    return this;
  }

  public controller(controller: Controller): this {
    for (const route of controller.routes()) {
      this.route(
        route.method,
        joinPaths(controller.path, route.path),
        route.handler,
      );
    }

    return this;
  }

  public async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (isCorsPreflight(request)) {
      const ctx = createContext(request, url, {});
      const handler = compose(this.middlewares, () => {
        return this.handleError(
          new HttpError(404, "Route not found", "not_found"),
          request,
        );
      });

      try {
        return await handler(ctx);
      } catch (error) {
        return this.handleError(error, request);
      }
    }

    const match = this.router.match(request.method, url.pathname);

    if ("error" in match) {
      const response = this.handleError(match.error, request);

      if (match.allowedMethods && match.allowedMethods.length > 0) {
        response.headers.set("allow", match.allowedMethods.join(", "));
      }

      return response;
    }

    const state: State = {};
    const ctx = createContext(request, url, match.params, state);

    try {
      const handler = compose(this.middlewares, match.handler);
      return await handler(ctx);
    } catch (error) {
      return this.handleError(error, request);
    }
  }

  private handleError(error: unknown, request: Request): Response {
    if (error instanceof HttpError) {
      return json(errorResponse(error, request), { status: error.status });
    }

    return json(
      errorResponse(
        new HttpError(500, "Internal server error", "internal_server_error"),
        request,
      ),
      { status: 500 },
    );
  }
}
