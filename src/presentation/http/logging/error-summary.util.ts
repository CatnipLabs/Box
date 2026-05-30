import { HttpError } from "../errors.ts";
import type { HttpLogContext } from "./http-log-context.type.ts";

export function errorSummary(error: unknown): HttpLogContext {
  if (error instanceof HttpError) {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      status: error.status,
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: "Unexpected error",
    };
  }

  return { message: String(error) };
}
