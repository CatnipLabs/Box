import type { Levels } from "../levels.enum.ts";
import type { LoggerClock } from "./logger-clock.type.ts";
import type { LogSink } from "./log-sink.type.ts";

export interface LoggerConstructorOptions {
  name?: string;
  level?: Levels;
  sink?: LogSink;
  clock?: LoggerClock;
}
