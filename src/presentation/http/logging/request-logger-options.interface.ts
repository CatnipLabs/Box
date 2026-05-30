import type { Logger } from "../../../infra/logger/logger.ts";

export interface RequestLoggerOptions {
  logger?: Logger;
  now?: () => number;
}
