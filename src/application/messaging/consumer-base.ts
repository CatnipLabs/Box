import type { EventBase } from "./event-base.ts";

export abstract class ConsumerBase<TEvent extends EventBase = EventBase> {
  public abstract handle(event: TEvent): Promise<void> | void;
}
