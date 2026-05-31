import type { RouteOptions } from "../http/docs/index.ts";
import type { HttpMethod } from "../http/types.ts";
import {
  addDecoratedRoute,
  createDecoratedRoute,
} from "./controller-metadata-store.ts";
import { createRouteInput } from "./create-route-input.util.ts";

import type { RouteDecoratorFunction } from "./route-decorator-function.type.ts";

export function Route(
  method: HttpMethod,
  path = "/",
  options?: RouteOptions,
): RouteDecoratorFunction {
  return (
    value: (this: unknown, input: unknown) => unknown,
    context: ClassMethodDecoratorContext,
  ): void => {
    if (context.kind !== "method") {
      throw new TypeError("Route decorators can only decorate methods");
    }

    context.addInitializer(function (this: unknown) {
      const controller = this as object;
      addDecoratedRoute(
        controller,
        createDecoratedRoute(
          method,
          path,
          context.name,
          (ctx) => Reflect.apply(value, this, [createRouteInput(ctx)]),
          options,
        ),
      );
    });
  };
}

export function Get(
  path = "/",
  options?: RouteOptions,
): RouteDecoratorFunction {
  return Route("GET", path, options);
}

export function Post(
  path = "/",
  options?: RouteOptions,
): RouteDecoratorFunction {
  return Route("POST", path, options);
}

export function Put(
  path = "/",
  options?: RouteOptions,
): RouteDecoratorFunction {
  return Route("PUT", path, options);
}

export function Patch(
  path = "/",
  options?: RouteOptions,
): RouteDecoratorFunction {
  return Route("PATCH", path, options);
}

export function Delete(
  path = "/",
  options?: RouteOptions,
): RouteDecoratorFunction {
  return Route("DELETE", path, options);
}

export function Options(
  path = "/",
  options?: RouteOptions,
): RouteDecoratorFunction {
  return Route("OPTIONS", path, options);
}

export function Head(
  path = "/",
  options?: RouteOptions,
): RouteDecoratorFunction {
  return Route("HEAD", path, options);
}
