import { HttpError } from "./http-error.ts";

export function methodNotAllowed(message = "Method not allowed"): HttpError {
  return new HttpError(405, message, "method_not_allowed");
}
