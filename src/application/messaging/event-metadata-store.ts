import type { AnyEventConstructor } from "./any-event-constructor.type.ts";
import type { EventMetadata } from "./event-metadata.interface.ts";
import type { EventOptions } from "./event-options.interface.ts";

const eventMetadata = new WeakMap<AnyEventConstructor, EventMetadata>();

export function markEvent(
  target: AnyEventConstructor,
  options: EventOptions,
): void {
  const name = options.name.trim();
  if (!name) throw new TypeError("Event name must be a non-empty string");

  eventMetadata.set(target, { name });
}

export function getEventMetadata(
  target: AnyEventConstructor,
): EventMetadata | undefined {
  return eventMetadata.get(target);
}

export function eventName(target: AnyEventConstructor): string {
  const metadata = eventMetadata.get(target);
  if (!metadata) throw new TypeError("Event must be decorated with @Event");
  return metadata.name;
}
