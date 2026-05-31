import { assert, assertEquals, assertRejects } from "@std/assert";
import {
  BackgroundJob,
  JobSchedule,
} from "../../../src/application/background-jobs/index.ts";
import {
  BackgroundJobRunner,
  denoCron,
  DenoCronRuntime,
} from "../../../src/infra/background-jobs/deno-cron/index.ts";
import { FakeKv } from "../../fixtures/background-jobs/fake_kv.ts";

@BackgroundJob({ name: "runtime.success", schedule: JobSchedule.EVERY_MINUTE })
class RuntimeSuccessJob extends BackgroundJob {
  public runs = 0;
  public seenSignal?: AbortSignal;

  public run(context: { readonly signal: AbortSignal }): void {
    this.runs += 1;
    this.seenSignal = context.signal;
  }
}

Deno.test("Deno Cron runtime: registers jobs with schedule and backoff", async () => {
  const kv = new FakeKv();
  const registered: Array<{
    handler: () => Promise<void> | void;
    name: string;
    options: { readonly backoffSchedule?: readonly number[] };
    schedule: string;
  }> = [];
  const runtime = new DenoCronRuntime(denoCron({
    cron: (name, schedule, options, handler) => {
      registered.push({
        handler,
        name,
        options,
        schedule: schedule as string,
      });
      return Promise.resolve();
    },
    kv,
  }));
  const job = new RuntimeSuccessJob();

  runtime.bindBackgroundJobs([{
    backoffSchedule: [1_000, 5_000],
    instance: job,
    lock: { leaseMs: 60_000 },
    name: "runtime.success",
    schedule: JobSchedule.EVERY_5_MINUTES,
  }]);

  assertEquals(registered.length, 1);
  assertEquals(registered[0].name, "runtime.success");
  assertEquals(registered[0].schedule, "*/5 * * * *");
  assertEquals(registered[0].options, { backoffSchedule: [1_000, 5_000] });

  await registered[0].handler();
  assertEquals(job.runs, 1);
  assert(job.seenSignal instanceof AbortSignal);
});

Deno.test("Background job runner: skips execution when the distributed lock is occupied", async () => {
  const kv = new FakeKv();
  const job = new RuntimeSuccessJob();
  const firstRuntime = new DenoCronRuntime(denoCron({
    cron: () => Promise.resolve(),
    instanceId: "instance-a",
    kv,
  }));
  const secondRuntime = new DenoCronRuntime(denoCron({
    cron: () => Promise.resolve(),
    instanceId: "instance-b",
    kv,
  }));

  const registrations = [{
    instance: job,
    lock: { leaseMs: 60_000 },
    name: "runtime.success",
    schedule: JobSchedule.EVERY_MINUTE,
  }];
  const firstRunner = firstRuntime.createRunnerForTest(registrations[0]);
  const secondRunner = secondRuntime.createRunnerForTest(registrations[0]);

  const acquired = firstRunner.run(registrations[0]);
  await secondRunner.run(registrations[0]);
  await acquired;

  assertEquals(job.runs, 1);
});

Deno.test("Background job runner: releases the lock when a job throws", async () => {
  const kv = new FakeKv();

  @BackgroundJob({ name: "runtime.throw", schedule: JobSchedule.EVERY_MINUTE })
  class ThrowingJob extends BackgroundJob {
    public run(): void {
      throw new Error("job failed");
    }
  }

  const runtime = new DenoCronRuntime(denoCron({
    cron: () => Promise.resolve(),
    kv,
  }));
  const registration = {
    instance: new ThrowingJob(),
    lock: { leaseMs: 60_000 },
    name: "runtime.throw",
    schedule: JobSchedule.EVERY_MINUTE,
  };
  const runner = runtime.createRunnerForTest(registration);

  await assertRejects(() => runner.run(registration), Error, "job failed");
  assertEquals(
    kv.has(["box", "background-jobs", "default", "runtime.throw", "lock"]),
    false,
  );
});

Deno.test("Background job runner: aborts and rejects when lock renewal fails", async () => {
  class SlowJob extends BackgroundJob {
    public signal?: AbortSignal;
    public resolve!: () => void;

    public run(context: { readonly signal: AbortSignal }): Promise<void> {
      this.signal = context.signal;
      return new Promise<void>((resolve) => {
        this.resolve = resolve;
      });
    }
  }

  const job = new SlowJob();
  const runner = new BackgroundJobRunner({
    lock: {
      acquire: () =>
        Promise.resolve({
          acquired: true,
          lock: {
            leaseMs: 30,
            ownerId: "instance-a",
            release: () => Promise.resolve(true),
            renew: () => Promise.resolve(false),
            runId: "run-1",
          },
        }),
    },
  });

  await assertRejects(
    () =>
      runner.run({
        instance: job,
        lock: { leaseMs: 30 },
        name: "runtime.renew-loss",
        schedule: JobSchedule.EVERY_MINUTE,
      }),
    Error,
    "Background job lock lost for runtime.renew-loss",
  );
  assertEquals(job.signal?.aborted, true);
  job.resolve();
});

Deno.test("Background job runner: does not overlap slow lock renewals", async () => {
  class SlowJob extends BackgroundJob {
    public resolve!: () => void;

    public run(): Promise<void> {
      return new Promise<void>((resolve) => {
        this.resolve = resolve;
      });
    }
  }

  const job = new SlowJob();
  let renewCalls = 0;
  let resolveRenew!: (value: boolean) => void;
  const firstRenewal = new Promise<boolean>((resolve) => {
    resolveRenew = resolve;
  });
  const runner = new BackgroundJobRunner({
    lock: {
      acquire: () =>
        Promise.resolve({
          acquired: true,
          lock: {
            leaseMs: 20,
            ownerId: "instance-a",
            release: () => Promise.resolve(true),
            renew: () => {
              renewCalls += 1;
              return firstRenewal;
            },
            runId: "run-1",
          },
        }),
    },
  });

  const running = runner.run({
    instance: job,
    lock: { leaseMs: 20 },
    name: "runtime.slow-renew",
    schedule: JobSchedule.EVERY_MINUTE,
  });

  await new Promise((resolve) => setTimeout(resolve, 35));
  assertEquals(renewCalls, 1);
  resolveRenew(true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  job.resolve();
  await running;
});

Deno.test("Background job runner: waits for in-flight renewal before releasing lock", async () => {
  class QuicklyFinishingJob extends BackgroundJob {
    public resolve!: () => void;

    public run(): Promise<void> {
      return new Promise<void>((resolve) => {
        this.resolve = resolve;
      });
    }
  }

  const job = new QuicklyFinishingJob();
  let releaseCalls = 0;
  let resolveRenew!: (value: boolean) => void;
  const firstRenewal = new Promise<boolean>((resolve) => {
    resolveRenew = resolve;
  });
  const runner = new BackgroundJobRunner({
    lock: {
      acquire: () =>
        Promise.resolve({
          acquired: true,
          lock: {
            leaseMs: 20,
            ownerId: "instance-a",
            release: () => {
              releaseCalls += 1;
              return Promise.resolve(true);
            },
            renew: () => firstRenewal,
            runId: "run-1",
          },
        }),
    },
  });

  const running = runner.run({
    instance: job,
    lock: { leaseMs: 20 },
    name: "runtime.release-after-renew",
    schedule: JobSchedule.EVERY_MINUTE,
  });

  await new Promise((resolve) => setTimeout(resolve, 15));
  job.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assertEquals(releaseCalls, 0);

  resolveRenew(true);
  await running;
  assertEquals(releaseCalls, 1);
});
