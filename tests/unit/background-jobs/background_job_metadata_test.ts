import { assertEquals, assertThrows } from "@std/assert";
import { getInjectableMetadata } from "../../../src/core/di/index.ts";
import {
  BackgroundJob,
  getBackgroundJobMetadata,
  JobSchedule,
} from "../../../src/application/background-jobs/index.ts";

class MetricsService {
  public static readonly testOnly = true;
}

@BackgroundJob({
  backoffSchedule: [1_000, 5_000],
  deps: [MetricsService],
  lock: { leaseMs: 120_000 },
  name: "metrics.rollup",
  schedule: JobSchedule.EVERY_15_MINUTES,
})
class MetricsRollupJob extends BackgroundJob {
  public run(): void {
    // test-only job
  }
}

Deno.test("BackgroundJob metadata: decorator stores job options and injectable kind", () => {
  const metadata = getBackgroundJobMetadata(MetricsRollupJob);

  assertEquals(metadata?.name, "metrics.rollup");
  assertEquals(metadata?.schedule, "*/15 * * * *");
  assertEquals(metadata?.dependencies, [MetricsService]);
  assertEquals(metadata?.backoffSchedule, [1_000, 5_000]);
  assertEquals(metadata?.lock, { leaseMs: 120_000 });
  assertEquals(getInjectableMetadata(MetricsRollupJob)?.kind, "background-job");
  assertEquals(
    getInjectableMetadata(MetricsRollupJob)?.dependencies,
    [MetricsService],
  );
});

Deno.test("BackgroundJob metadata: schedule presets expose common UTC cron expressions", () => {
  assertEquals(JobSchedule.EVERY_MINUTE, "* * * * *");
  assertEquals(JobSchedule.EVERY_5_MINUTES, "*/5 * * * *");
  assertEquals(JobSchedule.EVERY_15_MINUTES, "*/15 * * * *");
  assertEquals(JobSchedule.HOURLY, "0 * * * *");
  assertEquals(JobSchedule.DAILY_AT_1_AM_UTC, "0 1 * * *");
  assertEquals(JobSchedule.WEEKLY_AT_MIDNIGHT_UTC, "0 0 * * 7");
  assertEquals(JobSchedule.MONTHLY_AT_MIDNIGHT_UTC, "0 0 1 * *");
});

Deno.test("BackgroundJob metadata: decorator rejects blank job names", () => {
  assertThrows(
    () =>
      BackgroundJob({ name: "   ", schedule: JobSchedule.HOURLY })(
        class BlankNameJob extends BackgroundJob {
          public run(): void {
            // test-only job
          }
        },
        { kind: "class", name: "BlankNameJob" } as ClassDecoratorContext,
      ),
    TypeError,
    "Background job name must be a non-empty string",
  );
});

Deno.test("BackgroundJob metadata: decorator rejects blank string schedules", () => {
  assertThrows(
    () =>
      BackgroundJob({ name: "blank.schedule", schedule: "   " })(
        class BlankScheduleJob extends BackgroundJob {
          public run(): void {
            // test-only job
          }
        },
        { kind: "class", name: "BlankScheduleJob" } as ClassDecoratorContext,
      ),
    TypeError,
    "Background job schedule must be a non-empty cron expression",
  );
});

Deno.test("BackgroundJob metadata: decorator validates Deno Cron backoff limits", () => {
  assertThrows(
    () =>
      BackgroundJob({
        backoffSchedule: [1, 2, 3, 4, 5, 6],
        name: "too-many-retries",
        schedule: JobSchedule.HOURLY,
      })(
        class TooManyRetriesJob extends BackgroundJob {
          public run(): void {
            // test-only job
          }
        },
        { kind: "class", name: "TooManyRetriesJob" } as ClassDecoratorContext,
      ),
    TypeError,
    "Background job backoffSchedule supports at most 5 retries",
  );

  assertThrows(
    () =>
      BackgroundJob({
        backoffSchedule: [3_600_001],
        name: "too-long-retry",
        schedule: JobSchedule.HOURLY,
      })(
        class TooLongRetryJob extends BackgroundJob {
          public run(): void {
            // test-only job
          }
        },
        { kind: "class", name: "TooLongRetryJob" } as ClassDecoratorContext,
      ),
    TypeError,
    "Background job backoffSchedule delays must be between 1 and 3600000 milliseconds",
  );
});

Deno.test("BackgroundJob metadata: decorator validates lock lease values", () => {
  assertThrows(
    () =>
      BackgroundJob({
        lock: { leaseMs: 0 },
        name: "invalid-lease",
        schedule: JobSchedule.HOURLY,
      })(
        class InvalidLeaseJob extends BackgroundJob {
          public run(): void {
            // test-only job
          }
        },
        { kind: "class", name: "InvalidLeaseJob" } as ClassDecoratorContext,
      ),
    TypeError,
    "Background job lock leaseMs must be a positive finite number",
  );
});
