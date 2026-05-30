import { HttpError } from "./http-error.ts";

export function payloadTooLarge(message = "Request body too large"): HttpError {
  return new HttpError(413, message, "payload_too_large");
}
