import type { BackgroundJobRuntime } from "./background-job-runtime.interface.ts";

export interface BackgroundJobRuntimeOptions {
  createRuntime(): BackgroundJobRuntime;
}
