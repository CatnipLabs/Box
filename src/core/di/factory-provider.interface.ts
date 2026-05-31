import type { InjectionToken } from "./injection-token.type.ts";
import type { ProviderFactory } from "./provider-factory.type.ts";

export interface FactoryProvider<T = unknown> {
  readonly deps?: readonly InjectionToken[];
  readonly provide: InjectionToken<T>;
  readonly useFactory: ProviderFactory<T>;
}
