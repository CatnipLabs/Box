import type { HttpLogContext } from "./http-log-context.type.ts";

export function requestIdContext(request: Request): HttpLogContext {
  const requestId = request.headers.get("x-request-id") ??
    request.headers.get("x-correlation-id");
  return requestId ? { requestId } : {};
}
