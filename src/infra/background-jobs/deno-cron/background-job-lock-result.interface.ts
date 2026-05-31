import type { BackgroundJobLockHandle } from "./background-job-lock-handle.interface.ts";

export type BackgroundJobLockResult =
  | { readonly acquired: false }
  | { readonly acquired: true; readonly lock: BackgroundJobLockHandle };
