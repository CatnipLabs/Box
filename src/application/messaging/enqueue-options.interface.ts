import type { QueueKey } from "./queue-key.type.ts";

export interface EnqueueOptions {
  readonly backoffSchedule?: readonly number[];
  readonly delay?: number;
  readonly keysIfUndelivered?: readonly QueueKey[];
}
