import type { InjectionToken } from "../../core/di/index.ts";
import type { BackgroundJobLockOptions } from "./background-job-lock-options.interface.ts";
import type { CronSchedule } from "./cron-schedule.type.ts";

export interface BackgroundJobMetadata {
  readonly backoffSchedule?: readonly number[];
  readonly dependencies: readonly InjectionToken[];
  readonly lock?: BackgroundJobLockOptions;
  readonly name: string;
  readonly schedule: CronSchedule;
}
