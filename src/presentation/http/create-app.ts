import { AuthStrategyRegistry } from "./auth/index.ts";
import { Container } from "../../core/di/index.ts";
import { App, registerController } from "./app.ts";
import type { CreateAppOptions } from "./create-app-options.interface.ts";

export function createApp(options: CreateAppOptions): App {
  const container = new Container({ requireInjectableMetadata: true });

  for (const provider of options.providers ?? []) {
    container.registerProvider(provider);
  }

  for (const repository of options.repositories ?? []) {
    container.register(repository);
  }

  for (const service of options.services ?? []) {
    container.register(service);
  }

  for (const strategy of options.authStrategies ?? []) {
    container.register(strategy);
  }

  for (const controller of options.controllers) {
    container.register(controller);
  }

  container.validateGraph();

  const authStrategies = new AuthStrategyRegistry(
    options.authStrategies ?? [],
    container,
  );

  for (const strategy of options.authStrategies ?? []) {
    container.resolve(strategy);
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
