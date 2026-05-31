import type { InjectableOptions } from "../../core/di/index.ts";
import type { BackgroundJobLockOptions } from "./background-job-lock-options.interface.ts";
import type { CronSchedule } from "./cron-schedule.type.ts";

export interface BackgroundJobOptions extends InjectableOptions {
  readonly backoffSchedule?: readonly number[];
  readonly lock?: BackgroundJobLockOptions;
  readonly name: string;
  readonly schedule: CronSchedule;
}
