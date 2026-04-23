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

    if (!result.success || !result.data) {
      throw new Error(
        "Invalid logger constructor options: " + JSON.stringify(result.error),
      );
    }

    this.loggerOptions = result.data;
  }

  private getForegroundColor(level: Levels) {
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

  private getFormatedName() {
    if (!this.loggerOptions.name) return "";
    return `${BackgroundColors.RESET}${ForegroundColors.WHITE}[${BackgroundColors.RESET}${ForegroundColors.BLUE}${this.loggerOptions.name}${BackgroundColors.RESET}${ForegroundColors.WHITE}]${BackgroundColors.RESET} `;
  }

  private getFormatedLevel(level: Levels) {
    const color = this.getForegroundColor(level);
    return `${BackgroundColors.RESET}${ForegroundColors.WHITE}[${BackgroundColors.RESET}${color}${level}${BackgroundColors.RESET}${ForegroundColors.WHITE}]${BackgroundColors.RESET}`;
  }

  private getFormatedTime() {
    const time = new Date().toISOString();
    return `${BackgroundColors.RESET}${ForegroundColors.WHITE}[${ForegroundColors.GRAY}${time}${BackgroundColors.RESET}${ForegroundColors.WHITE}]${BackgroundColors.RESET}`;
  }

  private format(level: Levels, message: unknown) {
    return `${this.getFormatedName()} ${this.getFormatedLevel(level)} ${this.getFormatedTime()}: ${message}`;
  }

  public info(message: unknown) {
    console.log(this.format(Levels.INFO, message));
  }

  public warn(message: unknown) {
    console.warn(this.format(Levels.WARN, message));
  }

  public error(message: unknown) {
    console.error(this.format(Levels.ERROR, message));
  }

  public debug(message: unknown) {
    console.debug(this.format(Levels.DEBUG, message));
  }

  public trace(message: unknown) {
    console.log(this.format(Levels.TRACE, message));
  }
}
