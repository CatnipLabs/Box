import type { DenoQueueEnqueueOptions } from "./deno-queue-enqueue-options.interface.ts";

export interface DenoQueueKv {
  enqueue(
    value: unknown,
    options?: DenoQueueEnqueueOptions,
  ): Promise<Deno.KvCommitResult>;
  listenQueue(handler: (value: unknown) => Promise<void> | void): Promise<void>;
}
