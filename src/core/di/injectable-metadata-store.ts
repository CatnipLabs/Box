import type { InjectableKind } from "./injectable-kind.type.ts";
import type { InjectableMetadata } from "./injectable-metadata.interface.ts";
import type { InjectableOptions } from "./injectable-options.interface.ts";
import type { InjectionToken } from "./injection-token.type.ts";

const injectableMetadata = new WeakMap<InjectionToken, InjectableMetadata>();

export function markInjectable(
  target: InjectionToken,
  kind: InjectableKind,
  options: InjectableOptions = {},
): void {
  injectableMetadata.set(target, {
    dependencies: options.deps ?? options.inject ?? options.dependencies ?? [],
    kind,
  });
}

export function getInjectableMetadata(
  target: InjectionToken,
): InjectableMetadata | undefined {
  return injectableMetadata.get(target);
}
