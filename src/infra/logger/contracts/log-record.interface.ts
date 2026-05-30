import type { Levels } from "../levels.enum.ts";
import type { LogContext } from "./log-context.type.ts";

export interface LogRecord {
  level: Levels;
  levelName: keyof typeof Levels;
  service?: string;
  message: string;
  timestamp: string;
  context?: LogContext;
}
