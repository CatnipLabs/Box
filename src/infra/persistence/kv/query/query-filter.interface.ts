import type { Entity } from "../../../../domain/entities/entity.ts";
import type { KvEntityId } from "../contracts/kv-entity-id.type.ts";
import type { EntityField } from "./entity-field.type.ts";
import type { QueryOperator } from "./query-operator.type.ts";

export interface QueryFilter<TEntity extends Entity<KvEntityId>> {
  field: EntityField<TEntity>;
  operator: QueryOperator;
  value: unknown;
}
