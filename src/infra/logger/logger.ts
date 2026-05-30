import type { LogContext } from "./contracts/log-context.type.ts";
import type { LogRecord } from "./contracts/log-record.interface.ts";
import type { LoggerConstructorOptions } from "./contracts/logger-constructor-options.interface.ts";
import {
  safeJsonValue,
  safeStringify,
} from "../../core/serialization/index.ts";
import { LoggerConstructorSchema } from "./logger-constructor.schema.ts";
import { BackgroundColors } from "./background.colors.ts";
import { ForegroundColors } from "./foreground.colors.ts";
import { Levels } from "./levels.enum.ts";
import { messageToText } from "./utils/message-to-text.util.ts";

export class Logger {
  private readonly loggerOptions: LoggerConstructorOptions;

  public constructor(
    loggerConstructorOptions: LoggerConstructorOptions,
  ) {
    const result = LoggerConstructorSchema.safeParse(loggerConstructorOptions);

    if (!result.success) {
      throw new Error(
        "Invalid logger constructor options: " + JSON.stringify(result.error),
      );
    }

    this.loggerOptions = result.data;
  }

  public getForegroundColor(level: Levels): ForegroundColors {
    switch (level) {
      case Levels.ERROR:
        return ForegroundColors.RED;
      case Levels.WARN:
        return ForegroundColors.YELLOW;
      case Levels.INFO:
        return ForegroundColors.GREEN;
      case Levels.DEBUG:
        return ForegroundColors.CYAN;
      case Levels.TRACE:
        return ForegroundColors.GRAY;
      default:
        return ForegroundColors.WHITE;
    }
  }

  public getFormatedName(): string {
    if (!this.loggerOptions.name) return "";
    return `${BackgroundColors.RESET}${ForegroundColors.WHITE}[${BackgroundColors.RESET}${ForegroundColors.BLUE}${this.loggerOptions.name}${BackgroundColors.RESET}${ForegroundColors.WHITE}]${BackgroundColors.RESET} `;
  }

  public getFormatedLevel(level: Levels): string {
    const color = this.getForegroundColor(level);
    return `${BackgroundColors.RESET}${ForegroundColors.WHITE}[${BackgroundColors.RESET}${color}${level}${BackgroundColors.RESET}${ForegroundColors.WHITE}]${BackgroundColors.RESET}`;
  }

  public getFormatedTime(): string {
    return `${BackgroundColors.RESET}${ForegroundColors.WHITE}[${ForegroundColors.GRAY}${this.currentTimestamp()}${BackgroundColors.RESET}${ForegroundColors.WHITE}]${BackgroundColors.RESET}`;
  }

  public format(
    level: Levels,
    message: unknown,
    context?: LogContext,
  ): string {
    const suffix = context === undefined ? "" : ` ${safeStringify(context)}`;
    return `${this.getFormatedName()} ${
      this.getFormatedLevel(level)
    } ${this.getFormatedTime()}: ${messageToText(message)}${suffix}`;
  }

  public info(message: unknown, context?: LogContext): void {
    this.emit(Levels.INFO, message, context, console.log);
  }

  public warn(message: unknown, context?: LogContext): void {
    this.emit(Levels.WARN, message, context, console.warn);
  }

  public error(message: unknown, context?: LogContext): void {
    this.emit(Levels.ERROR, message, context, console.error);
  }

  public debug(message: unknown, context?: LogContext): void {
    this.emit(Levels.DEBUG, message, context, console.debug);
  }

  public trace(message: unknown, context?: LogContext): void {
    this.emit(Levels.TRACE, message, context, console.log);
  }

  public getServiceName(): string {
    return this.loggerOptions.name || "";
  }

  public toRecord(
    level: Levels,
    message: unknown,
    context?: LogContext,
  ): LogRecord {
    const record: LogRecord = {
      level,
      levelName: Levels[level] as keyof typeof Levels,
      message: messageToText(message),
      timestamp: this.currentTimestamp(),
    };

    if (this.loggerOptions.name) {
      record.service = this.loggerOptions.name;
    }

    if (context !== undefined) {
      record.context = safeJsonValue(context) as LogContext;
    }

    return record;
  }

  private emit(
    level: Levels,
    message: unknown,
    context: LogContext | undefined,
    writer: (message?: unknown, ...optionalParams: unknown[]) => void,
  ): void {
    if (!this.shouldLog(level)) {
      return;
    }

    try {
      if (this.loggerOptions.sink) {
        this.loggerOptions.sink(this.toRecord(level, message, context));
        return;
      }

      writer(this.format(level, message, context));
    } catch (_error) {
      // Logging must never break application flow.
    }
  }

  private shouldLog(level: Levels): boolean {
    return level <= (this.loggerOptions.level ?? Levels.INFO);
  }

  private currentTimestamp(): string {
    return (this.loggerOptions.clock?.() ?? new Date()).toISOString();
  }
}
