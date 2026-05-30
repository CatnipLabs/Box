import { safeJsonValue } from "../../../core/serialization/index.ts";
import type { HttpError } from "../errors.ts";

export function errorResponse(
  error: HttpError,
  request: Request,
): Record<string, unknown> {
  const url = new URL(request.url);
  const errorBody: Record<string, unknown> = {
    statusCode: error.status,
    code: error.code,
    message: error.message,
    path: url.pathname,
    method: request.method.toUpperCase(),
    timestamp: new Date().toISOString(),
  };

  const requestId = request.headers.get("x-request-id") ??
    request.headers.get("x-correlation-id");

  if (error.details !== undefined) {
    errorBody.details = safeJsonValue(error.details);
  }

  if (requestId) {
    errorBody.requestId = requestId;
  }

  return {
    success: false,
    error: errorBody,
  };
}
