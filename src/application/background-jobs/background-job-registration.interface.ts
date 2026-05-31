import type { BackgroundJobBase } from "./background-job-base.ts";
import type { BackgroundJobLockOptions } from "./background-job-lock-options.interface.ts";
import type { CronSchedule } from "./cron-schedule.type.ts";

export interface BackgroundJobRegistration {
  readonly backoffSchedule?: readonly number[];
  readonly instance: BackgroundJobBase;
  readonly lock?: BackgroundJobLockOptions;
  readonly name: string;
  readonly schedule: CronSchedule;
}
