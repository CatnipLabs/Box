import { eventName } from "../../../application/messaging/index.ts";
import type {
  AnyEventConstructor,
  ConsumerBase,
  ConsumerRegistration,
  EnqueueOptions,
  EventBase,
  MessagingRuntime,
  ProducerRegistration,
} from "../../../application/messaging/index.ts";
import type { DenoQueueEnqueueOptions } from "./deno-queue-enqueue-options.interface.ts";
import type { DenoQueueEnvelope } from "./deno-queue-envelope.interface.ts";
import type { DenoQueueOptions } from "./deno-queue-options.interface.ts";

export class DenoQueueRuntime implements MessagingRuntime {
  private listening = false;
  private readonly consumersByEvent = new Map<
    string,
    { event: AnyEventConstructor; instances: ConsumerBase[] }
  >();

  public constructor(private readonly options: DenoQueueOptions) {}

  public bindProducers(
    producers: readonly ProducerRegistration[],
    consumers: readonly ConsumerRegistration[],
  ): void {
    this.registerConsumers(consumers);
    this.configureProducers(producers);

    if (
      consumers.length > 0 && this.options.listen !== false && !this.listening
    ) {
      this.startListening();
    }
  }

  private startListening(): void {
    this.listening = true;
    this.options.kv.listenQueue((value) => this.handleQueueValue(value))
      .catch((error: unknown) => {
        this.listening = false;
        setTimeout(() => {
          throw error;
        });
      });
  }

  private configureProducers(producers: readonly ProducerRegistration[]): void {
    for (const producer of producers) {
      const name = eventName(producer.event);
      producer.instance.configureMessaging(
        producer.event,
        (event, options) =>
          this.options.kv.enqueue(
            toEnvelope(name, event),
            normalizeOptions(options),
          ),
        producer.defaultOptions,
      );
    }
  }

  private registerConsumers(
    consumers: readonly ConsumerRegistration[],
  ): void {
    for (const consumer of consumers) {
      const name = eventName(consumer.event);
      const existing = this.consumersByEvent.get(name);

      if (existing) {
        if (existing.event !== consumer.event) {
          throw new TypeError(
            `Duplicate queue event name "${name}" registered with different event classes`,
          );
        }
        existing.instances.push(consumer.instance);
        continue;
      }

      this.consumersByEvent.set(name, {
        event: consumer.event,
        instances: [consumer.instance],
      });
    }
  }

  private async handleQueueValue(value: unknown): Promise<void> {
    if (!isDenoQueueEnvelope(value)) return;

    const registration = this.consumersByEvent.get(value.event);
    if (!registration) return;

    const event = new registration.event(value.payload as never, {
      id: value.id,
      occurredAt: value.occurredAt,
    });

    for (const consumer of registration.instances) {
      await consumer.handle(event);
    }
  }
}

function toEnvelope(eventName: string, event: EventBase): DenoQueueEnvelope {
  return {
    __boxQueue: true,
    event: eventName,
    id: event.id,
    occurredAt: event.occurredAt.toISOString(),
    payload: event.payload,
    version: 1,
  };
}

function isDenoQueueEnvelope(value: unknown): value is DenoQueueEnvelope {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  return candidate.__boxQueue === true &&
    candidate.version === 1 &&
    typeof candidate.event === "string" &&
    typeof candidate.id === "string" &&
    typeof candidate.occurredAt === "string" &&
    "payload" in candidate;
}

function normalizeOptions(
  options: EnqueueOptions | undefined,
): DenoQueueEnqueueOptions | undefined {
  if (!options) return undefined;

  return {
    backoffSchedule: options.backoffSchedule,
    delay: options.delay,
    keysIfUndelivered: options.keysIfUndelivered as
      | readonly Deno.KvKey[]
      | undefined,
  };
}
