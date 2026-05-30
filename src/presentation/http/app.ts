import type {
  AuthRouteDescriptor,
  AuthStrategyResolver,
} from "./auth/index.ts";
import { runAuthStrategy } from "./auth/index.ts";
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
import { HttpStatus } from "./http-status.enum.ts";
import { compose } from "./middleware.ts";
import { Router } from "./router.ts";
import { json, toResponse } from "./response.ts";
import { errorResponse } from "./responses/index.ts";
import type { Context, Handler, HttpMethod, Middleware } from "./types.ts";
import { joinPaths } from "./utils/join-paths.util.ts";

const INTERNAL_ERROR_STATE_KEY = "box.error";
const REGISTER_ROUTE = Symbol("box.registerRoute");
const REGISTER_CONTROLLER = Symbol("box.registerController");

export class App {
  private readonly router = new Router();
  private readonly middlewares: Middleware[] = [];
  private readonly documentedRoutes: RegisteredRouteDocumentation[] = [];
  private composedHandler?: Handler;
  private docsOptions?: ResolvedDocsOptions;

  public constructor(
    options: AppOptions = {},
    private readonly authStrategyResolver?: AuthStrategyResolver,
  ) {
    this.docsOptions = resolveDocsOptions(options.docs);
  }

  public docs(options: AppOptions["docs"] = {}): this {
    this.docsOptions = resolveDocsOptions(options);
    return this;
  }

  public use(middleware: Middleware): this {
    this.middlewares.push(middleware);
    this.composedHandler = undefined;
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
        new HttpError(
          HttpStatus.INTERNAL_SERVER_ERROR,
          "Internal server error",
          "internal_server_error",
        ),
        request,
      ),
      { status: HttpStatus.INTERNAL_SERVER_ERROR },
    );
  }

  [REGISTER_ROUTE](
    method: HttpMethod,
    path: string,
    handler: Handler,
    options: RouteOptions = {},
  ): this {
    const normalizedPath = normalizeRoutePath(path);
    const routeHandler = createRouteHandler(
      handler,
      options,
      {
        method,
        operationId: options.operationId,
        path: normalizedPath,
      },
      this.authStrategyResolver,
    );

    this.router.add(method, path, routeHandler);
    this.documentedRoutes.push({
      method,
      path: normalizedPath,
      options,
    });
    return this;
  }

  [REGISTER_CONTROLLER](controller: object): this {
    for (const route of getControllerRoutes(controller)) {
      this[REGISTER_ROUTE](
        route.method,
        joinPaths(getControllerPath(controller), route.path),
        route.handler,
        route.options,
      );
    }

    return this;
  }
}

export function registerRoute(
  app: App,
  method: HttpMethod,
  path: string,
  handler: Handler,
  options?: RouteOptions,
): App {
  return app[REGISTER_ROUTE](method, path, handler, options);
}

export function registerController(app: App, controller: object): App {
  return app[REGISTER_CONTROLLER](controller);
}

function createRouteHandler(
  handler: Handler,
  options: RouteOptions,
  descriptor: AuthRouteDescriptor,
  authStrategyResolver?: AuthStrategyResolver,
): Handler {
  const authStrategy = options.auth === undefined
    ? undefined
    : resolveAuthStrategy(options, descriptor, authStrategyResolver);

  return async (ctx) => {
    if (authStrategy) {
      const authResponse = await runAuthStrategy(authStrategy, ctx);
      if (authResponse) return authResponse;
    }

    if (options.request) {
      ctx.validated = await validateRequestContract(ctx, options.request);
    }

    return toResponse(await handler(ctx), { status: options.status });
  };
}

function resolveAuthStrategy(
  options: RouteOptions,
  descriptor: AuthRouteDescriptor,
  authStrategyResolver?: AuthStrategyResolver,
) {
  if (options.auth === undefined) return undefined;

  if (!authStrategyResolver) {
    throw new TypeError(
      `${descriptor.method} ${descriptor.path} requires at least one auth strategy. ` +
        "Register an @AuthStrategy class in createApp({ authStrategies: [...] }) before protecting controllers or endpoints.",
    );
  }

  return authStrategyResolver(options.auth, descriptor);
}

function normalizeRoutePath(path: string): string {
  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}
