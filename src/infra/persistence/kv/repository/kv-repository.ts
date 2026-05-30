import type { Entity } from "../../../../domain/entities/entity.ts";
import { Repository } from "../../../../domain/repositories/index.ts";
import type { EntityConstructor } from "../../../../domain/repositories/index.ts";
import type { KvEntityMapper } from "../contracts/kv-entity-mapper.interface.ts";
import type { KvEntityId } from "../contracts/kv-entity-id.type.ts";
import type { KvKey } from "../contracts/kv-key.type.ts";
import type { KvRepositoryOptions } from "../contracts/kv-repository-options.interface.ts";
import type { KvStore } from "../contracts/kv-store.interface.ts";
import { defaultKvEntityMapper } from "../mapping/default-kv-entity-mapper.ts";
import { KvQueryBuilder } from "./kv-query-builder.ts";

export class KvRepository<
  TEntity extends Entity<KvEntityId>,
> extends Repository<TEntity> {
  public readonly collection: string;
  private readonly mapper: KvEntityMapper<TEntity>;

  public constructor(
    entity: EntityConstructor<TEntity>,
    private readonly kv: KvStore,
    options: KvRepositoryOptions<TEntity> = {},
  ) {
    super(entity);
    this.collection = options.collection ?? this.entityName;
    this.mapper = options.mapper ??
      defaultKvEntityMapper(entity, options.hydrator);
  }

  public keyOf(id: TEntity["id"]): KvKey {
    return [this.collection, id];
  }

  public async save(entity: TEntity): Promise<TEntity> {
    await this.kv.set(this.keyOf(entity.id), this.mapper.toValue(entity));
    return entity;
  }

  public async findById(id: TEntity["id"]): Promise<TEntity | undefined> {
    const result = await this.kv.get<Record<string, unknown>>(this.keyOf(id));

    if (result.value === null) {
      return undefined;
    }

    return this.mapper.fromValue(result.value);
  }

  public async deleteById(id: TEntity["id"]): Promise<void> {
    await this.kv.delete(this.keyOf(id));
  }

  public query(): KvQueryBuilder<TEntity> {
    return new KvQueryBuilder(this.kv, [this.collection], this.mapper);
  }

  public async all(): Promise<TEntity[]> {
    return await this.query().all();
  }
}
