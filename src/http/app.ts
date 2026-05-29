import { readJson, readText } from "./body.ts";
import { HttpError } from "./errors.ts";
import { compose } from "./middleware.ts";
import { json } from "./response.ts";
import { Router } from "./router.ts";
import type {
  Context,
  Handler,
  HttpMethod,
  Middleware,
  State,
} from "./types.ts";

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

  public async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const match = this.router.match(request.method, url.pathname);

    if ("error" in match) {
      const response = this.handleError(match.error);

      if (match.allowedMethods && match.allowedMethods.length > 0) {
        response.headers.set("allow", match.allowedMethods.join(", "));
      }

      return response;
    }

    const state: State = {};
    const ctx: Context = {
      request,
      url,
      params: match.params,
      query: url.searchParams,
      state,
      json: (options) => readJson(request, options),
      text: (options) => readText(request, options),
    };

    try {
      const handler = compose(this.middlewares, match.handler);
      return await handler(ctx);
    } catch (error) {
      return this.handleError(error);
    }
  }

  private handleError(error: unknown): Response {
    if (error instanceof HttpError) {
      const body: Record<string, unknown> = {
        status: error.status,
        error: error.code,
        message: error.message,
      };

      if (error.details !== undefined) {
        body.details = error.details;
      }

      return json(body, { status: error.status });
    }

    return json({
      status: 500,
      error: "internal_server_error",
      message: "Internal server error",
    }, { status: 500 });
  }
}
