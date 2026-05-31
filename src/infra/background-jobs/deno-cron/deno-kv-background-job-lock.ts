import type { BackgroundJobLockOptions } from "../../../application/background-jobs/index.ts";
import type { BackgroundJobLockRecord } from "./background-job-lock-record.interface.ts";
import type { BackgroundJobLockResult } from "./background-job-lock-result.interface.ts";
import type { BackgroundJobLock } from "./background-job-lock.interface.ts";
import type { DenoCronKv } from "./deno-cron-kv.interface.ts";
import { DenoKvBackgroundJobLockHandle } from "./deno-kv-background-job-lock-handle.ts";
import type { DenoKvBackgroundJobLockOptions } from "./deno-kv-background-job-lock-options.interface.ts";

const DEFAULT_LEASE_MS = 15 * 60 * 1000;
const DEFAULT_NAMESPACE = "default";
const LOCK_KEY_PREFIX = ["box", "background-jobs"] as const;

export class DenoKvBackgroundJobLock implements BackgroundJobLock {
  private readonly clock: () => Date;
  private readonly defaultLeaseMs: number;
  private readonly kv: DenoCronKv;
  private readonly namespace: string;
  private readonly ownerId: string;

  public constructor(options: DenoKvBackgroundJobLockOptions) {
    this.clock = options.clock ?? (() => new Date());
    this.defaultLeaseMs = options.leaseMs ?? DEFAULT_LEASE_MS;
    this.kv = options.kv;
    this.namespace = options.namespace ?? DEFAULT_NAMESPACE;
    this.ownerId = options.ownerId ?? crypto.randomUUID();
  }

  public async acquire(
    jobName: string,
    options: BackgroundJobLockOptions = {},
  ): Promise<BackgroundJobLockResult> {
    const leaseMs = options.leaseMs ?? this.defaultLeaseMs;
    if (leaseMs <= 0 || !Number.isFinite(leaseMs)) {
      throw new TypeError(
        "Background job lock leaseMs must be a positive finite number",
      );
    }

    const key = this.keyFor(jobName);
    const current = await this.kv.get<BackgroundJobLockRecord>(key);
    const now = this.clock();
    const runId = crypto.randomUUID();
    const record = this.createRecord(jobName, runId, leaseMs, now);

    const versionstamp = current.versionstamp;
    if (current.value) {
      return { acquired: false };
    }

    const commit = await this.kv.atomic()
      .check({ key, versionstamp })
      .set(key, record, { expireIn: leaseMs })
      .commit();

    if (!commit.ok) return { acquired: false };

    return {
      acquired: true,
      lock: new DenoKvBackgroundJobLockHandle({
        clock: this.clock,
        jobName,
        key,
        kv: this.kv,
        leaseMs,
        ownerId: this.ownerId,
        runId,
      }),
    };
  }

  private keyFor(jobName: string): Deno.KvKey {
    return [...LOCK_KEY_PREFIX, this.namespace, jobName, "lock"];
  }

  private createRecord(
    jobName: string,
    runId: string,
    leaseMs: number,
    now: Date,
  ): BackgroundJobLockRecord {
    return {
      acquiredAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + leaseMs).toISOString(),
      jobName,
      ownerId: this.ownerId,
      runId,
    };
  }
}
