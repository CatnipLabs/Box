import { Levels } from "./levels.enum.ts";

export interface LoggerConstructorOptions {
  name?: string;
  level?: Levels;
}

interface LoggerParseSuccess {
  success: true;
  data: LoggerConstructorOptions;
}

interface LoggerParseFailure {
  success: false;
  error: { message: string };
}

type LoggerParseResult = LoggerParseSuccess | LoggerParseFailure;

export const LoggerConstructorSchema: {
  safeParse(value: unknown): LoggerParseResult;
} = {
  safeParse(value: unknown): LoggerParseResult {
    if (!isPlainObject(value)) {
      return failure("Logger options must be an object");
    }

    const options = value as Record<string, unknown>;
    const data: LoggerConstructorOptions = {};

    if (options.name !== undefined) {
      if (typeof options.name !== "string") {
        return failure("Logger name must be a string");
      }

      data.name = options.name;
    }

    if (options.level !== undefined) {
      if (!isLevel(options.level)) {
        return failure("Logger level is invalid");
      }

      data.level = options.level;
    } else {
      data.level = Levels.INFO;
    }

    return { success: true, data };
  },
};

function failure(message: string): LoggerParseFailure {
  return { success: false, error: { message } };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLevel(value: unknown): value is Levels {
  return Object.values(Levels).includes(value as Levels);
}
