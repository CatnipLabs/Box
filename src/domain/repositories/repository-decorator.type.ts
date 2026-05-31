import type { InjectableOptions, InjectionToken } from "../../core/di/index.ts";
import type { Entity } from "../entities/entity.ts";
import type { EntityConstructor } from "./entity-constructor.type.ts";
import type { RepositoryBase } from "./repository-base.ts";

export type RepositoryDecorator = {
  new <TEntity extends Entity<unknown> = Entity>(
    entity: EntityConstructor<TEntity>,
  ): RepositoryBase<TEntity>;
  (options?: InjectableOptions): (
    target: InjectionToken,
    context: ClassDecoratorContext,
  ) => void;
};
