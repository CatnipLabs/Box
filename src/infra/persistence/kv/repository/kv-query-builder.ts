import type { Entity } from "../../../../domain/entities/entity.ts";
import type { KvEntityMapper } from "../contracts/kv-entity-mapper.interface.ts";
import type { KvEntityId } from "../contracts/kv-entity-id.type.ts";
import type { KvKey } from "../contracts/kv-key.type.ts";
import type { KvStore } from "../contracts/kv-store.interface.ts";
import type { EntityField } from "../query/entity-field.type.ts";
import { compareValues } from "../query/compare-values.util.ts";
import { matchesFilter } from "../query/matches-filter.util.ts";
import type { QueryFilter } from "../query/query-filter.interface.ts";
import type { QueryOperator } from "../query/query-operator.type.ts";
import type { QuerySort } from "../query/query-sort.interface.ts";
import type { SortDirection } from "../query/sort-direction.type.ts";

export class KvQueryBuilder<TEntity extends Entity<KvEntityId>> {
  private readonly filters: QueryFilter<TEntity>[] = [];
  private sort?: QuerySort<TEntity>;
  private maxResults?: number;
  private skip = 0;

  public constructor(
    private readonly kv: KvStore,
    private readonly prefix: KvKey,
    private readonly mapper: KvEntityMapper<TEntity>,
  ) {}

  public where(
    field: EntityField<TEntity>,
    operator: QueryOperator,
    value: unknown,
  ): this {
    this.filters.push({ field, operator, value });
    return this;
  }

  public orderBy(
    field: EntityField<TEntity>,
    direction: SortDirection = "asc",
  ): this {
    this.sort = { field, direction };
    return this;
  }

  public limit(count: number): this {
    this.maxResults = Math.max(0, count);
    return this;
  }

  public offset(count: number): this {
    this.skip = Math.max(0, count);
    return this;
  }

  public async first(): Promise<TEntity | undefined> {
    const [first] = await this.collect({ maxResults: 1, skip: this.skip });
    return first;
  }

  public async all(): Promise<TEntity[]> {
    return await this.collect({ maxResults: this.maxResults, skip: this.skip });
  }

  private async collect(options: {
    maxResults?: number;
    skip: number;
  }): Promise<TEntity[]> {
    const entities: TEntity[] = [];
    const canStopEarly = this.sort === undefined &&
      options.maxResults !== undefined;
    const requiredMatches = canStopEarly
      ? options.skip + options.maxResults!
      : Infinity;
    let matched = 0;

    for await (
      const entry of this.kv.list<Record<string, unknown>>({
        prefix: this.prefix,
      })
    ) {
      const entity = this.mapper.fromValue(entry.value);
      if (!this.matches(entity)) continue;

      matched++;
      if (this.sort === undefined && matched <= options.skip) continue;

      entities.push(entity);
      if (canStopEarly && matched >= requiredMatches) break;
    }

    if (this.sort) {
      const sort = this.sort;
      const sortedEntities = entities.toSorted((left, right) =>
        compareValues(
          left[sort.field],
          right[sort.field],
          sort.direction,
        )
      );
      const start = options.skip;
      const end = options.maxResults === undefined
        ? undefined
        : start + options.maxResults;
      return sortedEntities.slice(start, end);
    }

    return entities;
  }

  private matches(entity: TEntity): boolean {
    return this.filters.every((filter) =>
      matchesFilter(entity[filter.field], filter.operator, filter.value)
    );
  }
}
