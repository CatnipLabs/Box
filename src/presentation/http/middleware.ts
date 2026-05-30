import type { Context, Handler, Middleware } from "./types.ts";

export function compose(
  middlewares: Middleware[],
  handler: Handler,
): Handler {
  return (ctx: Context) => dispatch(ctx, middlewares, handler, 0);
}

async function dispatch(
  ctx: Context,
  middlewares: Middleware[],
  handler: Handler,
  index: number,
): Promise<Response> {
  const middleware = middlewares[index];

  if (!middleware) {
    return await handler(ctx);
  }

  let nextCalled = false;

  const response = await middleware(ctx, async () => {
    if (nextCalled) {
      throw new Error("next() called multiple times");
    }

    nextCalled = true;
    return await dispatch(ctx, middlewares, handler, index + 1);
  });

  return response;
}
