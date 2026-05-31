import type {
  BackgroundJobContext,
  BackgroundJobRegistration,
} from "../../../application/background-jobs/index.ts";
import type { BackgroundJobRunnerOptions } from "./background-job-runner-options.interface.ts";
import type { BackgroundJobLock } from "./background-job-lock.interface.ts";

export class BackgroundJobRunner {
  private readonly clock: () => Date;
  private readonly lock: BackgroundJobLock;

  public constructor(options: BackgroundJobRunnerOptions) {
    this.clock = options.clock ?? (() => new Date());
    this.lock = options.lock;
  }

  public async run(registration: BackgroundJobRegistration): Promise<void> {
    const acquired = await this.lock.acquire(
      registration.name,
      registration.lock,
    );
    if (!acquired.acquired) return;

    const startedAt = this.clock();
    const controller = new AbortController();
    let rejectLockLost: ((error: Error) => void) | undefined;
    const lockLost = new Promise<never>((_resolve, reject) => {
      rejectLockLost = reject;
    });

    const renewal: {
      current?: {
        readonly clear: () => void;
        readonly stop: () => Promise<void>;
      };
    } = {};

    const failWithLockLost = (error: Error): void => {
      renewal.current?.clear();
      controller.abort(error);
      rejectLockLost?.(error);
    };

    const renew = async (): Promise<void> => {
      const renewed = await acquired.lock.renew();
      if (renewed) return;

      failWithLockLost(
        new Error(`Background job lock lost for ${registration.name}`),
      );
    };

    renewal.current = this.startRenewal(
      acquired.lock.leaseMs,
      renew,
      failWithLockLost,
    );

    try {
      const context: BackgroundJobContext = {
        name: registration.name,
        runId: acquired.lock.runId,
        scheduledAt: startedAt,
        signal: controller.signal,
        startedAt,
      };
      await Promise.race([
        Promise.resolve(registration.instance.run(context)),
        lockLost,
      ]);
    } finally {
      await renewal.current?.stop();
      await acquired.lock.release();
    }
  }

  private startRenewal(
    leaseMs: number,
    renew: () => Promise<void>,
    failWithLockLost: (error: Error) => void,
  ): {
    readonly clear: () => void;
    readonly stop: () => Promise<void>;
  } {
    const intervalMs = Math.max(10, Math.floor(leaseMs / 2));
    let renewalInFlight: Promise<void> | undefined;
    const timer = setInterval(() => {
      if (renewalInFlight) return;
      renewalInFlight = renew()
        .catch((error: unknown) => {
          failWithLockLost(
            error instanceof Error
              ? error
              : new Error("Background job lock renewal failed"),
          );
        })
        .finally(() => {
          renewalInFlight = undefined;
        });
    }, intervalMs);

    return {
      clear: () => clearInterval(timer),
      stop: async () => {
        clearInterval(timer);
        await renewalInFlight;
      },
    };
  }
}
