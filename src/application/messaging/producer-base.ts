import type { EnqueueOptions } from "./enqueue-options.interface.ts";
import type { AnyEventConstructor } from "./any-event-constructor.type.ts";
import { EventBase } from "./event-base.ts";
import type { EventPayload } from "./event-payload.type.ts";
import type { MessageCommitResult } from "./message-commit-result.interface.ts";
import type { ProducerDispatcher } from "./producer-dispatcher.type.ts";

export class ProducerBase<TEvent extends EventBase = EventBase> {
  private defaultOptions: EnqueueOptions = {};
  private dispatcher?: ProducerDispatcher;
  private eventConstructor?: AnyEventConstructor;

  public configureMessaging(
    eventConstructor: AnyEventConstructor,
    dispatcher: ProducerDispatcher,
    defaultOptions: EnqueueOptions = {},
  ): void {
    this.eventConstructor = eventConstructor;
    this.dispatcher = dispatcher;
    this.defaultOptions = defaultOptions;
  }

  public async publish(
    input: TEvent | EventPayload<TEvent>,
    options: EnqueueOptions = {},
  ): Promise<MessageCommitResult> {
    if (!this.dispatcher || !this.eventConstructor) {
      throw new TypeError(
        "Producer is not attached to a queue runtime. Register it in createApp({ producers, queues }).",
      );
    }

    const event = input instanceof EventBase
      ? input
      : new this.eventConstructor(input as never);

    return await this.dispatcher(event, { ...this.defaultOptions, ...options });
  }
}
