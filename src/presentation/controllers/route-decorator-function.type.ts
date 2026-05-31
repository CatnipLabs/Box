export type RouteDecoratorFunction = (
  value: {
    bivarianceHack(this: unknown, input: unknown): unknown;
  }["bivarianceHack"],
  context: ClassMethodDecoratorContext,
) => void;
