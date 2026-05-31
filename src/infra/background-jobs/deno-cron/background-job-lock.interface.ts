import type { BackgroundJobLockOptions } from "../../../application/background-jobs/index.ts";
import type { BackgroundJobLockResult } from "./background-job-lock-result.interface.ts";

export interface BackgroundJobLock {
  acquire(
    jobName: string,
    options?: BackgroundJobLockOptions,
  ): Promise<BackgroundJobLockResult>;
}
