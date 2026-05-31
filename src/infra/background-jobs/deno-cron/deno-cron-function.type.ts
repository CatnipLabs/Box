import type { DenoCronSchedule } from "./deno-cron-schedule.type.ts";

export type DenoCronFunction = (
  name: string,
  schedule: DenoCronSchedule,
  options: {
    readonly backoffSchedule?: readonly number[];
    readonly signal?: AbortSignal;
  },
  handler: () => Promise<void> | void,
) => Promise<void>;
