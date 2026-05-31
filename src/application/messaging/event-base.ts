export class EventBase<TPayload = unknown> {
  public readonly id!: string;
  public readonly occurredAt!: Date;
  public readonly payload!: TPayload;
}
