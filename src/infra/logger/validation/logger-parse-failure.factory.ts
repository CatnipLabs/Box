import type { LoggerParseFailure } from "../contracts/logger-parse-failure.interface.ts";

export function loggerParseFailure(message: string): LoggerParseFailure {
  return { success: false, error: { message } };
}
