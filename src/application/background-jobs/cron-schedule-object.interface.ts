import type { CronScheduleField } from "./cron-schedule-field.type.ts";

export interface CronScheduleObject {
  readonly dayOfMonth?: CronScheduleField;
  readonly dayOfWeek?: CronScheduleField;
  readonly hour?: CronScheduleField;
  readonly minute?: CronScheduleField;
  readonly month?: CronScheduleField;
}
