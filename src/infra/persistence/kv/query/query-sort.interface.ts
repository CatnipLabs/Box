import type { Entity } from "../../../../domain/entities/entity.ts";
import type { KvEntityId } from "../contracts/kv-entity-id.type.ts";
import type { EntityField } from "./entity-field.type.ts";
import type { SortDirection } from "./sort-direction.type.ts";

export interface QuerySort<TEntity extends Entity<KvEntityId>> {
  field: EntityField<TEntity>;
  direction: SortDirection;
}
