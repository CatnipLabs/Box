import type { InjectionToken } from "./injection-token.type.ts";

export interface InjectableOptions {
  readonly dependencies?: readonly InjectionToken[];
  readonly deps?: readonly InjectionToken[];
  readonly inject?: readonly InjectionToken[];
}
