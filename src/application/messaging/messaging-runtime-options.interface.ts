import type { MessagingRuntime } from "./messaging-runtime.interface.ts";

export interface MessagingRuntimeOptions {
  createRuntime(): MessagingRuntime;
}
