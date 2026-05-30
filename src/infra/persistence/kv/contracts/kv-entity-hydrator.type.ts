import type { Entity } from "../../../../domain/entities/entity.ts";
import type { KvEntityId } from "./kv-entity-id.type.ts";

export type KvEntityHydrator<TEntity extends Entity<KvEntityId>> = (
  value: Record<string, unknown>,
) => TEntity;
