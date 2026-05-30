import type { InjectableKind } from "./injectable-kind.type.ts";
import type { InjectionToken } from "./injection-token.type.ts";

export interface InjectableMetadata {
  readonly dependencies: readonly InjectionToken[];
  readonly kind: InjectableKind;
}
