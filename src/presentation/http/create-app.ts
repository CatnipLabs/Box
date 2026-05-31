import {
  getConsumerMetadata,
  getProducerMetadata,
} from "../../application/messaging/index.ts";
import { getBackgroundJobMetadata } from "../../application/background-jobs/index.ts";
import type {
  BackgroundJobBase,
  BackgroundJobRegistration,
} from "../../application/background-jobs/index.ts";
import type {
  ConsumerBase,
  ConsumerRegistration,
  ProducerBase,
  ProducerRegistration,
} from "../../application/messaging/index.ts";
import { AuthStrategyRegistry } from "./auth/index.ts";
import { Container, type InjectionToken } from "../../core/di/index.ts";
import { App, registerController } from "./app.ts";
import type { CreateAppOptions } from "./create-app-options.interface.ts";

export function createApp(options: CreateAppOptions): App {
  const container = new Container({ requireInjectableMetadata: true });

  registerAppResources(container, options);

  container.validateGraph();

  const authStrategies = new AuthStrategyRegistry(
    options.authStrategies ?? [],
    container,
  );

  for (const strategy of options.authStrategies ?? []) {
    container.resolve(strategy);
  }

  const producers: ProducerRegistration[] = (options.producers ?? []).map(
    (producer) => {
      const metadata = getProducerMetadata(producer);
      if (!metadata) {
        throw new TypeError("Producer must be decorated with @Producer");
      }
      return {
        defaultOptions: metadata.defaultOptions,
        event: metadata.event,
        instance: container.resolve(producer) as ProducerBase,
      };
    },
  );

  const consumers: ConsumerRegistration[] = (options.consumers ?? []).map(
    (consumer) => {
      const metadata = getConsumerMetadata(consumer);
      if (!metadata) {
        throw new TypeError("Consumer must be decorated with @Consumer");
      }
      return {
        event: metadata.event,
        instance: container.resolve(consumer) as ConsumerBase,
      };
    },
  );

  const backgroundJobs: BackgroundJobRegistration[] = (
    options.backgroundJobs ?? []
  ).map((backgroundJob) => {
    const metadata = getBackgroundJobMetadata(backgroundJob);
    if (!metadata) {
      throw new TypeError(
        "Background job must be decorated with @BackgroundJob",
      );
    }
    return {
      backoffSchedule: metadata.backoffSchedule,
      instance: container.resolve(backgroundJob) as BackgroundJobBase,
      lock: metadata.lock,
      name: metadata.name,
      schedule: metadata.schedule,
    };
  });

  if (backgroundJobs.length > 0 && !options.scheduler) {
    throw new TypeError(
      "Background jobs require createApp({ scheduler: denoCron({ kv }) }).",
    );
  }

  if ((producers.length > 0 || consumers.length > 0) && !options.queues) {
    throw new TypeError(
      "Messaging producers or consumers require createApp({ queues: denoQueues({ kv }) }).",
    );
  }

  if (options.queues) {
    options.queues.createRuntime().bindProducers(producers, consumers);
  }

  if (options.scheduler) {
    options.scheduler.createRuntime().bindBackgroundJobs(backgroundJobs);
  }

  const app = new App(
    options,
    (requirement, route) => authStrategies.resolve(requirement, route),
  );

  for (const controller of options.controllers) {
    registerController(app, container.resolve(controller));
  }

  return app;
}

function registerAppResources(
  container: Container,
  options: CreateAppOptions,
): void {
  for (const provider of options.providers ?? []) {
    container.registerProvider(provider);
  }

  registerTokens(container, options.repositories);
  registerTokens(container, options.services);
  registerTokens(container, options.producers);
  registerTokens(container, options.backgroundJobs);
  registerTokens(container, options.consumers);
  registerTokens(container, options.authStrategies);
  registerTokens(container, options.controllers);
}

function registerTokens(
  container: Container,
  tokens: readonly InjectionToken[] | undefined,
): void {
  for (const token of tokens ?? []) {
    container.register(token);
  }
}
