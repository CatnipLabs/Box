import type { Entity } from "../entities/entity.ts";

export type EntityConstructor<
  TEntity extends Entity<unknown> = Entity<unknown>,
> = {
  new (...args: never[]): TEntity;
  readonly prototype: TEntity;
  readonly name: string;
};
