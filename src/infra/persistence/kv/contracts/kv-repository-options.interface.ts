import type { Entity } from "../../../../domain/entities/entity.ts";
import type { KvEntityHydrator } from "./kv-entity-hydrator.type.ts";
import type { KvEntityMapper } from "./kv-entity-mapper.interface.ts";
import type { KvEntityId } from "./kv-entity-id.type.ts";

export interface KvRepositoryOptions<TEntity extends Entity<KvEntityId>> {
  collection?: string;
  hydrator?: KvEntityHydrator<TEntity>;
  mapper?: KvEntityMapper<TEntity>;
}
