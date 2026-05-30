import {
  getControllerPath,
  getControllerRoutes,
} from "../controllers/controller-metadata-store.ts";
import { createContext } from "./context/index.ts";
import { createOpenApiDocument } from "./docs/create-openapi-document.util.ts";
import type {
  AppOptions,
  RegisteredRouteDocumentation,
  ResolvedDocsOptions,
  RouteOptions,
} from "./docs/index.ts";
import { resolveDocsOptions } from "./docs/resolve-docs-options.util.ts";
import { scalarHtml } from "./docs/scalar-html.util.ts";
import { validateRequestContract } from "./docs/validate-request-contract.util.ts";
import { HttpError } from "./errors.ts";
import { compose } from "./middleware.ts";
import { Router } from "./router.ts";
import { json, toResponse } from "./response.ts";
import { errorResponse } from "./responses/index.ts";
import type { Context, Handler, HttpMethod, Middleware } from "./types.ts";
import { joinPaths } from "./utils/join-paths.util.ts";

const INTERNAL_ERROR_STATE_KEY = "box.error";

export class App {
  private readonly router = new Router();
  private readonly middlewares: Middleware[] = [];
  private readonly documentedRoutes: RegisteredRouteDocumentation[] = [];
  private composedHandler?: Handler;
  private docsOptions?: ResolvedDocsOptions;

  public constructor(options: AppOptions = {}) {
    this.docsOptions = resolveDocsOptions(options.docs);
  }

  public docs(options: AppOptions["docs"] = {}): this {
    this.docsOptions = resolveDocsOptions(options);
    return this;
  }

  public get(path: string, handler: Handler, options?: RouteOptions): this {
    return this.route("GET", path, handler, options);
  }

  public post(path: string, handler: Handler, options?: RouteOptions): this {
    return this.route("POST", path, handler, options);
  }

  public put(path: string, handler: Handler, options?: RouteOptions): this {
    return this.route("PUT", path, handler, options);
  }

  public patch(path: string, handler: Handler, options?: RouteOptions): this {
    return this.route("PATCH", path, handler, options);
  }

  public delete(path: string, handler: Handler, options?: RouteOptions): this {
    return this.route("DELETE", path, handler, options);
  }

  public options(path: string, handler: Handler, options?: RouteOptions): this {
    return this.route("OPTIONS", path, handler, options);
  }

  public head(path: string, handler: Handler, options?: RouteOptions): this {
    return this.route("HEAD", path, handler, options);
  }

  public use(middleware: Middleware): this {
    this.middlewares.push(middleware);
    this.composedHandler = undefined;
    return this;
  }

  public route(
    method: HttpMethod,
    path: string,
    handler: Handler,
    options: RouteOptions = {},
  ): this {
    const routeHandler = createRouteHandler(handler, options);

    this.router.add(method, path, routeHandler);
    this.documentedRoutes.push({
      method,
      path: normalizeRoutePath(path),
      options,
    });
    return this;
  }

  public controller(controller: object): this {
    for (const route of getControllerRoutes(controller)) {
      this.route(
        route.method,
        joinPaths(getControllerPath(controller), route.path),
        route.handler,
        route.options,
      );
    }

    return this;
  }

  public async fetch(request: Request): Promise<Response> {
    const docsResponse = this.maybeHandleDocs(request);
    if (docsResponse) return docsResponse;

    const url = new URL(request.url);
    const ctx = createContext(request, url, {});

    try {
      return toResponse(await this.handler()(ctx));
    } catch (error) {
      return this.handleError(error, request);
    }
  }

  private maybeHandleDocs(request: Request): Response | undefined {
    const options = this.docsOptions;
    if (!options?.enabled || request.method !== "GET") return undefined;

    const pathname = new URL(request.url).pathname;

    if (pathname === options.openApiPath) {
      return json(createOpenApiDocument(this.documentedRoutes, options));
    }

    if (pathname === options.path) {
      return new Response(scalarHtml(options), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    return undefined;
  }

  private handler(): Handler {
    this.composedHandler ??= compose(
      this.middlewares,
      (ctx) => this.dispatch(ctx),
    );
    return this.composedHandler;
  }

  private async dispatch(ctx: Context): Promise<Response> {
    try {
      const match = this.router.match(ctx.request.method, ctx.url.pathname);

      if ("error" in match) {
        ctx.state[INTERNAL_ERROR_STATE_KEY] = match.error;
        const response = this.handleError(match.error, ctx.request);

        if (match.allowedMethods && match.allowedMethods.length > 0) {
          response.headers.set("allow", match.allowedMethods.join(", "));
        }

        return response;
      }

      ctx.params = match.params;
      return toResponse(await match.handler(ctx));
    } catch (error) {
      ctx.state[INTERNAL_ERROR_STATE_KEY] = error;
      return this.handleError(error, ctx.request);
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

function createRouteHandler(
  handler: Handler,
  options: RouteOptions,
): Handler {
  return async (ctx) => {
    if (options.request) {
      ctx.validated = await validateRequestContract(ctx, options.request);
    }

    return toResponse(await handler(ctx), { status: options.status });
  };
}

function normalizeRoutePath(path: string): string {
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}
