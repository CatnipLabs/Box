import { HttpStatus } from "../http-status.enum.ts";
import { HttpError } from "./http-error.ts";

export function notFound(message = "Route not found"): HttpError {
  return new HttpError(HttpStatus.NOT_FOUND, message, "not_found");
}
