import type { BackgroundJobLock } from "./background-job-lock.interface.ts";

export interface BackgroundJobRunnerOptions {
  readonly clock?: () => Date;
  readonly lock: BackgroundJobLock;
}
