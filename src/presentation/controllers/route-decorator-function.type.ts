export type RouteDecoratorFunction = (
  value: (this: unknown, input: never) => unknown,
  context: ClassMethodDecoratorContext,
) => void;
