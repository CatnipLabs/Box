import type { ConsumerRegistration } from "./consumer-registration.interface.ts";
import type { ProducerRegistration } from "./producer-registration.interface.ts";

export interface MessagingRuntime {
  bindProducers(
    producers: readonly ProducerRegistration[],
    consumers: readonly ConsumerRegistration[],
  ): void;
}
