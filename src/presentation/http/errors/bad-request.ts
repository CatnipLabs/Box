import { HttpError } from "./http-error.ts";

export function badRequest(
  message = "Bad request",
  details?: unknown,
): HttpError {
  return new HttpError(400, message, "bad_request", details);
}
