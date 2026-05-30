import type { InjectionToken } from "./injection-token.type.ts";

export type InjectableTarget<T = unknown> = InjectionToken<T> & {
  readonly inject?: readonly InjectionToken[];
  readonly dependencies?: readonly InjectionToken[];
};
