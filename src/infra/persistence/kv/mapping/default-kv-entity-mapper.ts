import type { Entity } from "../../../../domain/entities/entity.ts";
import type { EntityConstructor } from "../../../../domain/repositories/index.ts";
import type { KvEntityMapper } from "../contracts/kv-entity-mapper.interface.ts";
import type { KvEntityId } from "../contracts/kv-entity-id.type.ts";

export function defaultKvEntityMapper<
  TEntity extends Entity<KvEntityId>,
>(
  entity: EntityConstructor<TEntity>,
): KvEntityMapper<TEntity> {
  return {
    toValue(value: TEntity): Record<string, unknown> {
      return { ...value } as Record<string, unknown>;
    },
    fromValue(value: Record<string, unknown>): TEntity {
      return Object.assign(Object.create(entity.prototype), value) as TEntity;
    },
  };
}
