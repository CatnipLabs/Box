import type { Entity } from "../../../../domain/entities/entity.ts";
import type { KvEntityMapper } from "./kv-entity-mapper.interface.ts";
import type { KvEntityId } from "./kv-entity-id.type.ts";

export interface KvRepositoryOptions<TEntity extends Entity<KvEntityId>> {
  collection?: string;
  mapper?: KvEntityMapper<TEntity>;
}
