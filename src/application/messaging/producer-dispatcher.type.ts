import type { EnqueueOptions } from "./enqueue-options.interface.ts";
import type { EventBase } from "./event-base.ts";
import type { MessageCommitResult } from "./message-commit-result.interface.ts";

export type ProducerDispatcher = (
  event: EventBase,
  options?: EnqueueOptions,
) => Promise<MessageCommitResult>;
