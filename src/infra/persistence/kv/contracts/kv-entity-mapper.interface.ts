import type { Entity } from "../../../../domain/entities/entity.ts";
import type { KvEntityId } from "./kv-entity-id.type.ts";

export interface KvEntityMapper<TEntity extends Entity<KvEntityId>> {
  toValue(entity: TEntity): Record<string, unknown>;
  fromValue(value: Record<string, unknown>): TEntity;
}
