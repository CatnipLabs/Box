import type { InjectionToken } from "./injection-token.type.ts";

export interface ValueProvider<T = unknown> {
  readonly provide: InjectionToken<T>;
  readonly useValue: T;
}
