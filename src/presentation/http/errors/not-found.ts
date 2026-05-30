import { HttpError } from "./http-error.ts";

export function notFound(message = "Route not found"): HttpError {
  return new HttpError(404, message, "not_found");
}
