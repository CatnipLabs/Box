import type { AuthRequirement } from "../http/auth/index.ts";
import type { ControllerTarget } from "./controller-target.type.ts";
import { setControllerAuth, setRouteAuth } from "./auth-metadata-store.ts";

export type AuthDecorator = (
  requirement?: AuthRequirement,
) => (
  value: ControllerTarget | ((input: never) => unknown),
  context: ClassDecoratorContext | ClassMethodDecoratorContext,
) => void;

export const Auth: AuthDecorator = (requirement: AuthRequirement = true) => {
  return (
    value: ControllerTarget | ((input: never) => unknown),
    context: ClassDecoratorContext | ClassMethodDecoratorContext,
  ): void => {
    if (context.kind === "class") {
      setControllerAuth(value as ControllerTarget, requirement);
      return;
    }

    if (context.kind === "method") {
      context.addInitializer(function (this: unknown) {
        setRouteAuth(this as object, context.name, requirement);
      });
      return;
    }

    throw new TypeError("@Auth can only decorate classes or methods");
  };
};
