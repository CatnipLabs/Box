import type { HttpLogContext } from "./http-log-context.type.ts";

export interface HttpLogger {
  info(message: unknown, context?: HttpLogContext): void;
  error(message: unknown, context?: HttpLogContext): void;
}
