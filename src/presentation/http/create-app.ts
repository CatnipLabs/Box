import { Container } from "../../core/di/index.ts";
import { App } from "./app.ts";
import type { CreateAppOptions } from "./create-app-options.interface.ts";

export function createApp(options: CreateAppOptions): App {
  const app = new App(options);
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

  for (const controller of options.controllers) {
    container.register(controller);
  }

  for (const controller of options.controllers) {
    app.controller(container.resolve(controller));
  }

  return app;
}
