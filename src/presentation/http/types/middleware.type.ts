import type { Context } from "./context.interface.ts";
import type { MaybePromise } from "./maybe-promise.type.ts";
import type { Next } from "./next.type.ts";

export type Middleware = (ctx: Context, next: Next) => MaybePromise<Response>;
