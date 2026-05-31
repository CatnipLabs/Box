import type {
  BackgroundJobRegistration,
  BackgroundJobRuntime,
  CronSchedule,
  CronScheduleObject,
} from "../../../application/background-jobs/index.ts";
import { BackgroundJobRunner } from "./background-job-runner.ts";
import { DenoKvBackgroundJobLock } from "./deno-kv-background-job-lock.ts";
import type { DenoCronOptions } from "./deno-cron-options.interface.ts";
import type { DenoCronSchedule } from "./deno-cron-schedule.type.ts";

export class DenoCronRuntime implements BackgroundJobRuntime {
  private readonly cron: NonNullable<DenoCronOptions["cron"]>;
  private readonly options: DenoCronOptions;

  public constructor(options: DenoCronOptions) {
    if (!options.cron) {
      throw new TypeError("DenoCronRuntime requires a cron function");
    }

    this.cron = options.cron;
    this.options = options;
  }

  public bindBackgroundJobs(
    jobs: readonly BackgroundJobRegistration[],
  ): void {
    this.assertUniqueNames(jobs);

    for (const job of jobs) {
      const runner = this.createRunnerForTest(job);
      const cronOptions = job.backoffSchedule
        ? { backoffSchedule: job.backoffSchedule }
        : {};
      void this.cron(
        job.name,
        toDenoSchedule(job.schedule),
        cronOptions,
        () => runner.run(job),
      );
    }
  }

  public createRunnerForTest(
    _registration: BackgroundJobRegistration,
  ): BackgroundJobRunner {
    return new BackgroundJobRunner({
      clock: this.options.clock,
      lock: new DenoKvBackgroundJobLock({
        clock: this.options.clock,
        kv: this.options.kv,
        leaseMs: this.options.lockDefaults?.leaseMs,
        namespace: this.options.namespace,
        ownerId: this.options.instanceId,
      }),
    });
  }

  private assertUniqueNames(jobs: readonly BackgroundJobRegistration[]): void {
    const names = new Set<string>();
    for (const job of jobs) {
      if (names.has(job.name)) {
        throw new TypeError(`Duplicate background job name: ${job.name}`);
      }
      names.add(job.name);
    }
  }
}

function toDenoSchedule(schedule: CronSchedule): DenoCronSchedule {
  if (typeof schedule === "string") return schedule;
  return toDenoCronSchedule(schedule);
}

function toDenoCronSchedule(schedule: CronScheduleObject): Deno.CronSchedule {
  return {
    dayOfMonth: schedule.dayOfMonth,
    dayOfWeek: schedule.dayOfWeek,
    hour: schedule.hour,
    minute: schedule.minute,
    month: schedule.month,
  };
}
