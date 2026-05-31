export interface BackgroundJobContext {
  readonly name: string;
  readonly runId: string;
  readonly scheduledAt: Date;
  readonly signal: AbortSignal;
  readonly startedAt: Date;
}
