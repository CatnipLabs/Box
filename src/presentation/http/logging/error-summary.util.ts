import type { LogContext } from "../../../infra/logger/contracts/log-context.type.ts";
import { messageToText } from "../../../infra/logger/utils/message-to-text.util.ts";

export function errorSummary(error: unknown): LogContext {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return { message: messageToText(error) };
}
