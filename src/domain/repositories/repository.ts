import { Entity } from "../entities/entity.ts";
import type { EntityConstructor } from "./entity-constructor.type.ts";

export class Repository<TEntity extends Entity<unknown> = Entity> {
  public constructor(public readonly entity: EntityConstructor<TEntity>) {
    if (!(entity.prototype instanceof Entity)) {
      throw new TypeError("Repository entity must extend Entity");
    }
  }

  public get entityName(): string {
    return this.entity.name;
  }
}
