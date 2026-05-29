export interface HttpErrorOptions {
  code?: string;
  details?: unknown;
}

export class HttpError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(
    status: number,
    message: string,
    code?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code ?? defaultCode(status);
    this.details = details;
  }
}

export function notFound(message = "Route not found"): HttpError {
  return new HttpError(404, message, "not_found");
}

export function methodNotAllowed(message = "Method not allowed"): HttpError {
  return new HttpError(405, message, "method_not_allowed");
}

export function badRequest(
  message = "Bad request",
  details?: unknown,
): HttpError {
  return new HttpError(400, message, "bad_request", details);
}

export function payloadTooLarge(message = "Request body too large"): HttpError {
  return new HttpError(413, message, "payload_too_large");
}

export function defaultCode(status: number): string {
  switch (status) {
    case 400:
      return "bad_request";
    case 404:
      return "not_found";
    case 405:
      return "method_not_allowed";
    case 413:
      return "payload_too_large";
    case 500:
      return "internal_server_error";
    default:
      return "http_error";
  }
}
