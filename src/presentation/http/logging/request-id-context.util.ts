import type { LogContext } from "../../../infra/logger/contracts/log-context.type.ts";

export function requestIdContext(request: Request): LogContext {
  const requestId = request.headers.get("x-request-id") ??
    request.headers.get("x-correlation-id");
  return requestId ? { requestId } : {};
}
