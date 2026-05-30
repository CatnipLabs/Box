import type { Middleware } from "../types.ts";
import { appendVary } from "./append-vary.util.ts";
import { corsAllowedHeaders } from "./cors-allowed-headers.util.ts";
import type { CorsOptions } from "./cors-options.interface.ts";
import { DEFAULT_CORS_METHODS } from "./default-cors-methods.constant.ts";
import { resolveCorsOrigin } from "./resolve-cors-origin.util.ts";

export function cors(options: CorsOptions = {}): Middleware {
  const originOption = options.origin ?? "*";
  const methods = options.methods ?? DEFAULT_CORS_METHODS;

  return async (ctx, next) => {
    const requestOrigin = ctx.request.headers.get("origin");
    const allowedOrigin = resolveCorsOrigin(originOption, requestOrigin);
    const isPreflight = ctx.request.method.toUpperCase() === "OPTIONS" &&
      ctx.request.headers.has("access-control-request-method");

    const response = isPreflight
      ? new Response(null, { status: 204 })
      : await next();

    if (!allowedOrigin) {
      return response;
    }

    response.headers.set("access-control-allow-origin", allowedOrigin);
    appendVary(response.headers, "Origin");

    if (options.credentials) {
      response.headers.set("access-control-allow-credentials", "true");
    }
    if (options.exposedHeaders && options.exposedHeaders.length > 0) {
      response.headers.set(
        "access-control-expose-headers",
        options.exposedHeaders.join(", "),
      );
    }

    if (isPreflight) {
      response.headers.set("access-control-allow-methods", methods.join(", "));
      response.headers.set(
        "access-control-allow-headers",
        corsAllowedHeaders(ctx.request, options.allowedHeaders),
      );

      if (options.maxAge !== undefined) {
        response.headers.set("access-control-max-age", String(options.maxAge));
      }
    }

    return response;
  };
}
