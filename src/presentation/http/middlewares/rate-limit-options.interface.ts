import type { Context } from "../types.ts";

export interface RateLimitOptions {
  readonly kv: Deno.Kv;
  readonly limit: number;
  readonly windowMs: number;
  readonly namespace?: string;
  readonly keyPrefix?: readonly Deno.KvKeyPart[];
  readonly identifier?: (ctx: Context) => string | Promise<string>;
  readonly includeHeaders?: boolean;
  readonly skip?: (ctx: Context) => boolean | Promise<boolean>;
  readonly clock?: () => number;
  readonly maxAtomicRetries?: number;
}
