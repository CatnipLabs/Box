import { HttpStatus } from "../http-status.enum.ts";
import { HttpError } from "./http-error.ts";

export function badRequest(
  message = "Bad request",
  details?: unknown,
): HttpError {
  return new HttpError(HttpStatus.BAD_REQUEST, message, "bad_request", details);
}
