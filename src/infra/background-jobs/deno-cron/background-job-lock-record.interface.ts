export interface BackgroundJobLockRecord {
  readonly acquiredAt: string;
  readonly expiresAt: string;
  readonly jobName: string;
  readonly ownerId: string;
  readonly runId: string;
}
