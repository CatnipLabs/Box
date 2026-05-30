import type { HttpLogger } from "./http-logger.interface.ts";

export interface RequestLoggerOptions {
  logger?: HttpLogger;
  now?: () => number;
}
