import type { ClassProvider } from "./class-provider.interface.ts";
import type { FactoryProvider } from "./factory-provider.interface.ts";
import type { InjectionToken } from "./injection-token.type.ts";
import type { ValueProvider } from "./value-provider.interface.ts";

export type Provider<T = unknown> =
  | ClassProvider<T>
  | FactoryProvider<T>
  | InjectionToken<T>
  | ValueProvider<T>;
