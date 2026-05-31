import type { Context } from "./context.interface.ts";
import type { MaybePromise } from "./maybe-promise.type.ts";

export type Handler = (ctx: Context) => MaybePromise<unknown>;
