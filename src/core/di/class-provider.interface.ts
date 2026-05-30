import type { InjectionToken } from "./injection-token.type.ts";

export interface ClassProvider<T = unknown> {
  readonly provide: InjectionToken<T>;
  readonly useClass: InjectionToken<T>;
}
