import type { LogRecord } from "./log-record.interface.ts";

export type LogSink = (record: LogRecord) => void;
