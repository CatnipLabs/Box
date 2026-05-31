export type InjectionToken<T = unknown> = {
  readonly prototype: T;
  readonly name: string;
};
