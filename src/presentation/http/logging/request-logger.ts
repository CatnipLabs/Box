import type { Middleware } from "../types.ts";
import { Levels } from "../../../infra/logger/levels.enum.ts";
import { Logger } from "../../../infra/logger/logger.ts";
import type { RequestLoggerOptions } from "./request-logger-options.interface.ts";
import { errorSummary } from "./error-summary.util.ts";
import { requestIdContext } from "./request-id-context.util.ts";
import { roundDuration } from "../../../infra/logger/utils/round-duration.util.ts";

export type { RequestLoggerOptions } from "./request-logger-options.interface.ts";

export function requestLogger(options: RequestLoggerOptions = {}): Middleware {
  const logger = options.logger ?? new Logger({
    name: "Box.Http",
    level: Levels.INFO,
  });
  const now = options.now ?? (() => performance.now());

  return async (ctx, next) => {
    const start = now();

    try {
      const response = await next();
      logger.info("HTTP request completed", {
        method: ctx.request.method.toUpperCase(),
        path: ctx.url.pathname,
        status: response.status,
        durationMs: roundDuration(now() - start),
        ...requestIdContext(ctx.request),
      });
      return response;
    } catch (error) {
      logger.error("HTTP request failed", {
        method: ctx.request.method.toUpperCase(),
        path: ctx.url.pathname,
        durationMs: roundDuration(now() - start),
        ...requestIdContext(ctx.request),
        error: errorSummary(error),
      });
      throw error;
    }
  };
}
