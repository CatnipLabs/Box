import { Levels } from "./levels.enum.ts";
import type { LoggerConstructorOptions } from "./contracts/logger-constructor-options.interface.ts";
import type { LoggerParseResult } from "./contracts/logger-parse-result.type.ts";
import type { LoggerClock } from "./contracts/logger-clock.type.ts";
import type { LogSink } from "./contracts/log-sink.type.ts";
import { isLevel } from "./validation/is-level.predicate.ts";
import { isPlainObject } from "./validation/is-plain-object.predicate.ts";
import { loggerParseFailure } from "./validation/logger-parse-failure.factory.ts";

export type { LogContext } from "./contracts/log-context.type.ts";
export type { LogRecord } from "./contracts/log-record.interface.ts";
export type { LogSink } from "./contracts/log-sink.type.ts";
export type { LoggerClock } from "./contracts/logger-clock.type.ts";
export type { LoggerConstructorOptions } from "./contracts/logger-constructor-options.interface.ts";

export const LoggerConstructorSchema: {
  safeParse(value: unknown): LoggerParseResult;
} = {
  safeParse(value: unknown): LoggerParseResult {
    if (!isPlainObject(value)) {
      return loggerParseFailure("Logger options must be an object");
    }

    const options = value as Record<string, unknown>;
    const data: LoggerConstructorOptions = {};

    if (options.name !== undefined) {
      if (typeof options.name !== "string") {
        return loggerParseFailure("Logger name must be a string");
      }

      data.name = options.name;
    }

    if (options.level !== undefined) {
      if (!isLevel(options.level)) {
        return loggerParseFailure("Logger level is invalid");
      }

      data.level = options.level;
    } else {
      data.level = Levels.INFO;
    }

    if (options.sink !== undefined) {
      if (typeof options.sink !== "function") {
        return loggerParseFailure("Logger sink must be a function");
      }

      data.sink = options.sink as LogSink;
    }

    if (options.clock !== undefined) {
      if (typeof options.clock !== "function") {
        return loggerParseFailure("Logger clock must be a function");
      }

      data.clock = options.clock as LoggerClock;
    }

    return { success: true, data };
  },
};
