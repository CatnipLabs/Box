export type EntityField<TEntity> = Extract<keyof TEntity, string>;
