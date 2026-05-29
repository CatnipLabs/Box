import {
  type LoggerConstructorOptions,
  LoggerConstructorSchema,
} from "./logger-constructor.schema.ts";

import { BackgroundColors } from "./background.colors.ts";
import { ForegroundColors } from "./foreground.colors.ts";
import { Levels } from "./levels.enum.ts";

export class Logger {
  private readonly loggerOptions: LoggerConstructorOptions;

  constructor(
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
    const time = new Date().toISOString();
    return `${BackgroundColors.RESET}${ForegroundColors.WHITE}[${ForegroundColors.GRAY}${time}${BackgroundColors.RESET}${ForegroundColors.WHITE}]${BackgroundColors.RESET}`;
  }

  public format(level: Levels, message: unknown): string {
    return `${this.getFormatedName()} ${
      this.getFormatedLevel(level)
    } ${this.getFormatedTime()}: ${message}`;
  }

  public info(message: unknown): void {
    console.log(this.format(Levels.INFO, message));
  }

  public warn(message: unknown): void {
    console.warn(this.format(Levels.WARN, message));
  }

  public error(message: unknown): void {
    console.error(this.format(Levels.ERROR, message));
  }

  public debug(message: unknown): void {
    console.debug(this.format(Levels.DEBUG, message));
  }

  public trace(message: unknown): void {
    console.log(this.format(Levels.TRACE, message));
  }

  public getServiceName(): string {
    return this.loggerOptions.name || "";
  }
}
