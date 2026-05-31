import type { BackgroundJobRegistration } from "./background-job-registration.interface.ts";

export interface BackgroundJobRuntime {
  bindBackgroundJobs(jobs: readonly BackgroundJobRegistration[]): void;
}
