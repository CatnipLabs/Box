import type { Middleware } from "../types.ts";
import type { RequestTimeOptions } from "./request-time-options.interface.ts";

const DEFAULT_RESPONSE_TIME_HEADER = "x-response-time-ms";

export function requestTime(options: RequestTimeOptions = {}): Middleware {
  const headerName = options.headerName ?? DEFAULT_RESPONSE_TIME_HEADER;
  const overwrite = options.overwrite ?? false;

  return async (_ctx, next) => {
    const startedAt = performance.now();
    const response = await next();
    const durationMs = performance.now() - startedAt;

    if (overwrite || !response.headers.has(headerName)) {
      response.headers.set(headerName, durationMs.toFixed(3));
    }

    return response;
  };
}
