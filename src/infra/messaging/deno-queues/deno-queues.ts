import type { DenoQueueKv } from "./deno-queue-kv.interface.ts";
import type { DenoQueueOptions } from "./deno-queue-options.interface.ts";
import { DenoQueueRuntime } from "./deno-queue-runtime.ts";

export function denoQueues(
  options: { readonly kv: DenoQueueKv; readonly listen?: boolean },
): DenoQueueOptions {
  return {
    ...options,
    createRuntime: () => denoQueueRuntime(options),
  };
}

function denoQueueRuntime(
  options: { readonly kv: DenoQueueKv; readonly listen?: boolean },
): DenoQueueRuntime {
  return new DenoQueueRuntime({
    ...options,
    createRuntime: () => denoQueueRuntime(options),
  });
}
