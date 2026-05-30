import type { MessagingRuntimeOptions } from "../../../application/messaging/index.ts";
import type { DenoQueueKv } from "./deno-queue-kv.interface.ts";

export interface DenoQueueOptions extends MessagingRuntimeOptions {
  readonly kv: DenoQueueKv;
  readonly listen?: boolean;
}
