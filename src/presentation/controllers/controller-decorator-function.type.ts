import type { ControllerTarget } from "./controller-target.type.ts";

export type ControllerDecoratorFunction = (
  target: ControllerTarget,
  context: ClassDecoratorContext,
) => void;
