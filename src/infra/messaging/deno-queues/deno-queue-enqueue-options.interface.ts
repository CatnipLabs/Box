export interface DenoQueueEnqueueOptions {
  readonly backoffSchedule?: readonly number[];
  readonly delay?: number;
  readonly keysIfUndelivered?: readonly Deno.KvKey[];
}
