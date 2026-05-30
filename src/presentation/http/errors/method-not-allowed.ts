import { HttpStatus } from "../http-status.enum.ts";
import { HttpError } from "./http-error.ts";

export function methodNotAllowed(message = "Method not allowed"): HttpError {
  return new HttpError(
    HttpStatus.METHOD_NOT_ALLOWED,
    message,
    "method_not_allowed",
  );
}
