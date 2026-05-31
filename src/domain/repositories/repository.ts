import { markInjectable } from "../../core/di/index.ts";
import type { InjectableOptions, InjectionToken } from "../../core/di/index.ts";
import { Entity } from "../entities/entity.ts";
import type { EntityConstructor } from "./entity-constructor.type.ts";
import { RepositoryBase } from "./repository-base.ts";
import type { RepositoryDecorator } from "./repository-decorator.type.ts";

function createRepositoryDecorator(options?: InjectableOptions) {
  return (
    target: InjectionToken,
    context: ClassDecoratorContext,
  ): void => {
    if (context.kind !== "class") {
      throw new TypeError("@Repository can only decorate classes");
    }

    markInjectable(target, "repository", options);
  };
}

function RepositoryRuntime<TEntity extends Entity<unknown> = Entity>(
  this: RepositoryBase<TEntity> | undefined,
  entityOrOptions?: EntityConstructor<TEntity> | InjectableOptions,
) {
  if (new.target) {
    const entity = entityOrOptions as EntityConstructor<TEntity> | undefined;
    if (!entity || !(entity.prototype instanceof Entity)) {
      throw new TypeError("Repository entity must extend Entity");
    }

    Object.defineProperty(this, "entity", {
      configurable: true,
      enumerable: true,
      value: entity,
      writable: false,
    });
    return;
  }

  return createRepositoryDecorator(
    entityOrOptions as InjectableOptions | undefined,
  );
}

RepositoryRuntime.prototype = RepositoryBase.prototype;
Object.setPrototypeOf(RepositoryRuntime, RepositoryBase);

export const Repository = RepositoryRuntime as unknown as RepositoryDecorator;
