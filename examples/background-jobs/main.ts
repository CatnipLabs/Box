import {
  type BackgroundJobContext,
  type BackgroundJobRuntimeOptions,
  Box,
} from "../../src/mod.ts";

@Box.Service()
class InventoryCleanupService {
  private lastRunAt?: string;
  private runs = 0;

  public cleanup(now: Date): void {
    this.runs += 1;
    this.lastRunAt = now.toISOString();
  }

  public status(): { lastRunAt?: string; runs: number } {
    return { lastRunAt: this.lastRunAt, runs: this.runs };
  }
}

@Box.BackgroundJob({
  deps: [InventoryCleanupService],
  lock: { leaseMs: 5 * 60 * 1000 },
  name: "inventory.cleanup",
  schedule: Box.JobSchedule.EVERY_15_MINUTES,
})
class InventoryCleanupJob extends Box.BackgroundJob {
  public constructor(private readonly cleanup: InventoryCleanupService) {
    super();
  }

  public run(context: BackgroundJobContext): void {
    this.cleanup.cleanup(context.startedAt);
  }
}

@Box.Controller("/jobs", { deps: [InventoryCleanupService] })
class JobsController {
  public constructor(private readonly cleanup: InventoryCleanupService) {}

  @Box.Get("/inventory-cleanup")
  public inventoryCleanup(): { lastRunAt?: string; runs: number } {
    return this.cleanup.status();
  }
}

export function createBackgroundJobApp(scheduler: BackgroundJobRuntimeOptions) {
  return Box.createApp({
    backgroundJobs: [InventoryCleanupJob],
    controllers: [JobsController],
    scheduler,
    services: [InventoryCleanupService],
  });
}

// Deno Deploy discovers cron definitions during top-level module evaluation.
// In a real application use:
// const kv = await Deno.openKv();
// export default createBackgroundJobApp(Box.denoCron({ kv }));
