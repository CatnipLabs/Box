import type { LoggerConstructorOptions } from "./logger-constructor-options.interface.ts";

export interface LoggerParseSuccess {
  success: true;
  data: LoggerConstructorOptions;
}
