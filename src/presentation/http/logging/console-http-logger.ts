import { safeStringify } from "../../../core/serialization/index.ts";
import type { HttpLogContext } from "./http-log-context.type.ts";
import type { HttpLogger } from "./http-logger.interface.ts";

export class ConsoleHttpLogger implements HttpLogger {
  public constructor(private readonly name = "Box.Http") {}

  public info(message: unknown, context?: HttpLogContext): void {
    safeWrite(console.log, this.name, message, context);
  }

  public error(message: unknown, context?: HttpLogContext): void {
    safeWrite(console.error, this.name, message, context);
  }
}

function safeWrite(
  writer: (message?: unknown, ...optionalParams: unknown[]) => void,
  name: string,
  message: unknown,
  context?: HttpLogContext,
): void {
  try {
    const prefix = name ? `[${name}] ` : "";
    if (context === undefined) {
      writer(`${prefix}${String(message)}`);
      return;
    }

    writer(`${prefix}${String(message)} ${safeStringify(context)}`);
  } catch (_error) {
    // Logging must never break an HTTP request.
  }
}
