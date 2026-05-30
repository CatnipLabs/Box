export interface DenoQueueEnvelope {
  readonly __boxQueue: true;
  readonly event: string;
  readonly id: string;
  readonly occurredAt: string;
  readonly payload: unknown;
  readonly version: 1;
}
