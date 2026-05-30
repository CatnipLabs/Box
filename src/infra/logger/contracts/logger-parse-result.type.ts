import type { LoggerParseFailure } from "./logger-parse-failure.interface.ts";
import type { LoggerParseSuccess } from "./logger-parse-success.interface.ts";

export type LoggerParseResult = LoggerParseSuccess | LoggerParseFailure;
