import type { DenoCronKv } from "./deno-cron-kv.interface.ts";

export interface DenoKvBackgroundJobLockOptions {
  readonly clock?: () => Date;
  readonly kv: DenoCronKv;
  readonly leaseMs?: number;
  readonly namespace?: string;
  readonly ownerId?: string;
}
