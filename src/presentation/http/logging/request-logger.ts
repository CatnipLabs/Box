import type { Middleware } from "../types.ts";
import { ConsoleHttpLogger } from "./console-http-logger.ts";
import { errorSummary } from "./error-summary.util.ts";
import { requestIdContext } from "./request-id-context.util.ts";
import { roundDuration } from "./round-duration.util.ts";
import type { RequestLoggerOptions } from "./request-logger-options.interface.ts";

const INTERNAL_ERROR_STATE_KEY = "box.error";

export type { RequestLoggerOptions } from "./request-logger-options.interface.ts";
export type { HttpLogger } from "./http-logger.interface.ts";
export type { HttpLogContext } from "./http-log-context.type.ts";

export function requestLogger(options: RequestLoggerOptions = {}): Middleware {
  const logger = options.logger ?? new ConsoleHttpLogger();
  const now = options.now ?? (() => performance.now());

  return async (ctx, next) => {
    const start = now();

    try {
      const response = await next();
      const context = {
        method: ctx.request.method.toUpperCase(),
        path: ctx.url.pathname,
        status: response.status,
        durationMs: roundDuration(now() - start),
        ...requestIdContext(ctx.request),
      };
      const internalError = ctx.state[INTERNAL_ERROR_STATE_KEY];

      if (internalError !== undefined || response.status >= 500) {
        safeLog(() =>
          logger.error("HTTP request failed", {
            ...context,
            error: errorSummary(internalError),
          })
        );
      } else {
        safeLog(() => logger.info("HTTP request completed", context));
      }

      return response;
    } catch (error) {
      safeLog(() =>
        logger.error("HTTP request failed", {
          method: ctx.request.method.toUpperCase(),
          path: ctx.url.pathname,
          durationMs: roundDuration(now() - start),
          ...requestIdContext(ctx.request),
          error: errorSummary(error),
        })
      );
      throw error;
    }
  };
}

function safeLog(write: () => void): void {
  try {
    write();
  } catch (_error) {
    // Log sinks are observability helpers. They must never change HTTP behavior.
  }
}
