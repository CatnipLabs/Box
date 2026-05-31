import type { BackgroundJobLockHandle } from "./background-job-lock-handle.interface.ts";
import type { BackgroundJobLockRecord } from "./background-job-lock-record.interface.ts";
import type { DenoCronKv } from "./deno-cron-kv.interface.ts";

export class DenoKvBackgroundJobLockHandle implements BackgroundJobLockHandle {
  public readonly leaseMs: number;
  public readonly ownerId: string;
  public readonly runId: string;

  private readonly clock: () => Date;
  private readonly jobName: string;
  private readonly key: Deno.KvKey;
  private readonly kv: DenoCronKv;

  public constructor(options: {
    readonly clock: () => Date;
    readonly jobName: string;
    readonly key: Deno.KvKey;
    readonly kv: DenoCronKv;
    readonly leaseMs: number;
    readonly ownerId: string;
    readonly runId: string;
  }) {
    this.clock = options.clock;
    this.jobName = options.jobName;
    this.key = options.key;
    this.kv = options.kv;
    this.leaseMs = options.leaseMs;
    this.ownerId = options.ownerId;
    this.runId = options.runId;
  }

  public async renew(): Promise<boolean> {
    const current = await this.kv.get<BackgroundJobLockRecord>(this.key);
    if (!this.owns(current.value)) return false;

    const renewed: BackgroundJobLockRecord = {
      ...current.value,
      expiresAt: new Date(this.clock().getTime() + this.leaseMs).toISOString(),
    };

    const commit = await this.kv.atomic()
      .check({ key: this.key, versionstamp: current.versionstamp })
      .set(this.key, renewed, { expireIn: this.leaseMs })
      .commit();

    return commit.ok;
  }

  public async release(): Promise<boolean> {
    const current = await this.kv.get<BackgroundJobLockRecord>(this.key);
    if (!this.owns(current.value)) return false;

    const commit = await this.kv.atomic()
      .check({ key: this.key, versionstamp: current.versionstamp })
      .delete(this.key)
      .commit();

    return commit.ok;
  }

  private owns(
    record: BackgroundJobLockRecord | null,
  ): record is BackgroundJobLockRecord {
    return record?.jobName === this.jobName &&
      record.ownerId === this.ownerId &&
      record.runId === this.runId;
  }
}
