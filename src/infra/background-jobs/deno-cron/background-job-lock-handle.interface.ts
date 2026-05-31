export interface BackgroundJobLockHandle {
  readonly leaseMs: number;
  readonly ownerId: string;
  readonly runId: string;
  release(): Promise<boolean>;
  renew(): Promise<boolean>;
}
