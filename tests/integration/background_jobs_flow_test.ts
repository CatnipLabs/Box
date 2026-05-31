import { assertEquals, assertThrows } from "@std/assert";
import {
  BackgroundJob,
  type BackgroundJobRegistration,
  type BackgroundJobRuntime,
  type BackgroundJobRuntimeOptions,
  Controller,
  createApp,
  Event,
  Get,
  JobSchedule,
  Producer,
  Service,
} from "../../src/mod.ts";

@Event({ name: "background.integration" })
class BackgroundIntegrationEvent extends Event<{ id: string }> {
  public static readonly eventName = "background.integration";
}

@Producer({ event: BackgroundIntegrationEvent })
class BackgroundIntegrationProducer
  extends Producer<BackgroundIntegrationEvent> {
  public static readonly testOnly = true;
}

@Service({ deps: [BackgroundIntegrationProducer] })
class BackgroundIntegrationService {
  public runs = 0;

  public constructor(public readonly producer: BackgroundIntegrationProducer) {}

  public run(): void {
    this.runs += 1;
  }
}

@BackgroundJob({
  deps: [BackgroundIntegrationService, BackgroundIntegrationProducer],
  name: "background.integration",
  schedule: JobSchedule.EVERY_15_MINUTES,
})
class BackgroundIntegrationJob extends BackgroundJob {
  public constructor(
    private readonly service: BackgroundIntegrationService,
    public readonly producer: BackgroundIntegrationProducer,
  ) {
    super();
  }

  public run(): void {
    this.service.run();
  }
}

@Controller("/background-status", { deps: [BackgroundIntegrationService] })
class BackgroundStatusController {
  public constructor(private readonly service: BackgroundIntegrationService) {}

  @Get("/")
  public status(): { runs: number } {
    return { runs: this.service.runs };
  }
}

Deno.test("Background jobs integration: createApp wires scheduler with container-resolved jobs", async () => {
  const scheduler = new RecordingScheduler();
  const app = createApp({
    backgroundJobs: [BackgroundIntegrationJob],
    controllers: [BackgroundStatusController],
    producers: [BackgroundIntegrationProducer],
    queues: fakeQueueRuntimeOptions(),
    scheduler,
    services: [BackgroundIntegrationService],
  });

  assertEquals(scheduler.runtime.registrations.length, 1);
  const registration = scheduler.runtime.registrations[0];
  assertEquals(registration.name, "background.integration");
  assertEquals(registration.schedule, "*/15 * * * *");
  assertEquals(registration.instance instanceof BackgroundIntegrationJob, true);

  await registration.instance.run({
    name: registration.name,
    runId: "manual-run",
    scheduledAt: new Date("2026-05-30T20:00:00.000Z"),
    signal: new AbortController().signal,
    startedAt: new Date("2026-05-30T20:00:00.000Z"),
  });

  const response = await app.fetch(
    new Request("http://localhost/background-status"),
  );
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { runs: 1 });
});

Deno.test("Background jobs integration: queue runtime binds producers before scheduler", () => {
  const order: string[] = [];
  const scheduler = new RecordingScheduler(() => order.push("scheduler"));

  createApp({
    backgroundJobs: [BackgroundIntegrationJob],
    controllers: [],
    producers: [BackgroundIntegrationProducer],
    queues: fakeQueueRuntimeOptions(() => order.push("queues")),
    scheduler,
    services: [BackgroundIntegrationService],
  });

  assertEquals(order, ["queues", "scheduler"]);
});

Deno.test("Background jobs integration: no scheduler side effects when producers lack queue runtime", () => {
  const scheduler = new RecordingScheduler();

  assertThrows(
    () =>
      createApp({
        backgroundJobs: [BackgroundIntegrationJob],
        controllers: [],
        producers: [BackgroundIntegrationProducer],
        scheduler,
        services: [BackgroundIntegrationService],
      }),
    TypeError,
    "Messaging producers or consumers require createApp({ queues: denoQueues({ kv }) })",
  );
  assertEquals(scheduler.runtime.registrations.length, 0);
});

Deno.test("Background jobs integration: jobs fail closed without scheduler runtime", () => {
  assertThrows(
    () =>
      createApp({
        backgroundJobs: [BackgroundIntegrationJob],
        controllers: [],
        producers: [BackgroundIntegrationProducer],
        queues: fakeQueueRuntimeOptions(),
        services: [BackgroundIntegrationService],
      }),
    TypeError,
    "Background jobs require createApp({ scheduler: denoCron({ kv }) })",
  );
});

class RecordingScheduler implements BackgroundJobRuntimeOptions {
  public readonly runtime: RecordingBackgroundJobRuntime;

  public constructor(onBind?: () => void) {
    this.runtime = new RecordingBackgroundJobRuntime(onBind);
  }

  public createRuntime(): BackgroundJobRuntime {
    return this.runtime;
  }
}

class RecordingBackgroundJobRuntime implements BackgroundJobRuntime {
  public readonly registrations: BackgroundJobRegistration[] = [];

  public constructor(private readonly onBind?: () => void) {}

  public bindBackgroundJobs(
    registrations: readonly BackgroundJobRegistration[],
  ): void {
    this.onBind?.();
    this.registrations.push(...registrations);
  }
}

function fakeQueueRuntimeOptions(onBind?: () => void) {
  return {
    createRuntime() {
      return {
        bindProducers(): void {
          onBind?.();
        },
      };
    },
  };
}
