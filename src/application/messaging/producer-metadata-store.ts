import type { InjectionToken } from "../../core/di/index.ts";
import { getEventMetadata } from "./event-metadata-store.ts";
import type { ProducerMetadata } from "./producer-metadata.interface.ts";
import type { ProducerOptions } from "./producer-options.interface.ts";

const producerMetadata = new WeakMap<InjectionToken, ProducerMetadata>();

export function markProducer(
  target: InjectionToken,
  options: ProducerOptions,
): void {
  if (!getEventMetadata(options.event)) {
    throw new TypeError("Producer event must be decorated with @Event");
  }

  producerMetadata.set(target, {
    defaultOptions: {
      backoffSchedule: options.backoffSchedule,
      delay: options.delay,
      keysIfUndelivered: options.keysIfUndelivered,
    },
    event: options.event,
  });
}

export function getProducerMetadata(
  target: InjectionToken,
): ProducerMetadata | undefined {
  return producerMetadata.get(target);
}
