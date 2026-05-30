import type { InjectionToken } from "../../core/di/index.ts";
import { getEventMetadata } from "./event-metadata-store.ts";
import type { ConsumerMetadata } from "./consumer-metadata.interface.ts";
import type { ConsumerOptions } from "./consumer-options.interface.ts";

const consumerMetadata = new WeakMap<InjectionToken, ConsumerMetadata>();

export function markConsumer(
  target: InjectionToken,
  options: ConsumerOptions,
): void {
  if (!getEventMetadata(options.event)) {
    throw new TypeError("Consumer event must be decorated with @Event");
  }

  consumerMetadata.set(target, {
    event: options.event,
  });
}

export function getConsumerMetadata(
  target: InjectionToken,
): ConsumerMetadata | undefined {
  return consumerMetadata.get(target);
}
