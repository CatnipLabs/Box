# Background Jobs with Deno Cron

Box provides first-class background jobs on top of `Deno.cron`. Jobs are
registered during `createApp(...)` startup, resolved by the same singleton DI
container as controllers/services, and protected by a Deno KV distributed lock
so only one application instance performs the work for a given tick.

## Basic usage

```ts
import { Box } from "@catniplabs/box";

@Box.Service()
class ReportsService {
  public async rebuildDailyReports(): Promise<void> {
    // Keep side effects idempotent; cron jobs can be retried.
  }
}

@Box.BackgroundJob({
  deps: [ReportsService],
  lock: { leaseMs: 10 * 60 * 1000 },
  name: "reports.daily-rebuild",
  schedule: Box.JobSchedule.DAILY_AT_1_AM_UTC,
  backoffSchedule: [1_000, 5_000, 30_000],
})
class DailyReportsJob extends Box.BackgroundJob {
  public constructor(private readonly reports: ReportsService) {
    super();
  }

  public async run(): Promise<void> {
    await this.reports.rebuildDailyReports();
  }
}

const kv = await Deno.openKv();
const app = Box.createApp({
  backgroundJobs: [DailyReportsJob],
  controllers: [HealthController],
  scheduler: Box.denoCron({ kv }),
  services: [ReportsService],
});

export default {
  fetch: (request: Request) => app.fetch(request),
};
```

## Schedule presets

Use `JobSchedule` when you do not want to type raw cron expressions:

```ts
@Box.BackgroundJob({
  name: "metrics.rollup",
  schedule: Box.JobSchedule.EVERY_15_MINUTES,
})
class MetricsRollupJob extends Box.BackgroundJob {
  public run(): void {}
}
```

Presets that mention UTC are named explicitly because Deno Cron runs schedules
in UTC. You can still pass a custom cron string or Deno-style object schedule
when a preset is not enough.

## Dependency injection boundary

Background jobs are application workers, not repositories or HTTP handlers. Box
validates the boundary at startup:

- background jobs may inject services;
- background jobs may inject producers;
- background jobs may not inject repositories, controllers, consumers, auth
  strategies, middleware, or other background jobs;
- services may not inject background jobs.

This keeps job orchestration in the application layer. Put persistence in a
service/repository flow, and publish async follow-up work through producers when
needed.

## Multi-instance safety

`Box.denoCron({ kv })` uses Deno KV atomic operations for each job tick:

1. read the lock key for the job name and namespace;
2. acquire with an atomic `check(...).set(..., { expireIn })`;
3. skip execution when another instance owns the lock;
4. renew the lock while the job is still running;
5. abort the job if renewal loses ownership;
6. release only when the same owner/run still owns the lock.

This protects Deno Deploy and horizontally scaled deployments where multiple
instances evaluate the same module at the same time. Tune `lock.leaseMs` per
job: it should be longer than the normal job runtime, but short enough to
recover from crashed instances.

## Deno Deploy startup caveat

Deno Deploy discovers `Deno.cron` definitions during top-level module
evaluation. Create the app and register jobs at module startup, not lazily
inside a request handler.

## Retries

`backoffSchedule` is passed through to `Deno.cron`. Box validates Deno's current
limits at startup: at most five retry delays, and each delay must be between `1`
and `3_600_000` milliseconds.
