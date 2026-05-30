import { HttpStatus } from "../http-status.enum.ts";
import { HttpError } from "./http-error.ts";

export function payloadTooLarge(message = "Request body too large"): HttpError {
  return new HttpError(
    HttpStatus.PAYLOAD_TOO_LARGE,
    message,
    "payload_too_large",
  );
}
