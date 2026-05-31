import { HttpError } from "../errors.ts";
import { HttpStatus } from "../http-status.enum.ts";
import { json } from "../response.ts";
import { errorResponse } from "../responses/index.ts";
import type { Context, Middleware } from "../types.ts";
import type { RateLimitOptions } from "./rate-limit-options.interface.ts";

const DEFAULT_KEY_PREFIX: readonly Deno.KvKeyPart[] = ["box", "rate-limit"];
const DEFAULT_NAMESPACE = "default";
const DEFAULT_MAX_ATOMIC_RETRIES = 3;

export function rateLimit(options: RateLimitOptions): Middleware {
  const limit = normalizePositiveInteger(options.limit, "limit");
  const windowMs = normalizePositiveInteger(options.windowMs, "windowMs");
  const keyPrefix = options.keyPrefix ?? DEFAULT_KEY_PREFIX;
  const namespace = options.namespace ?? DEFAULT_NAMESPACE;
  const includeHeaders = options.includeHeaders ?? true;
  const now = options.clock ?? (() => Date.now());
  const maxAtomicRetries = options.maxAtomicRetries ??
    DEFAULT_MAX_ATOMIC_RETRIES;

  return async (ctx, next) => {
    if (await options.skip?.(ctx)) return await next();

    const timestamp = now();
    const windowId = Math.floor(timestamp / windowMs);
    const resetAt = (windowId + 1) * windowMs;
    const retryAfterSeconds = secondsUntil(resetAt, timestamp);
    const identifier = await resolveIdentifier(ctx, options.identifier);
    const key: Deno.KvKey = [...keyPrefix, namespace, identifier, windowId];

    const result = await consumeToken({
      kv: options.kv,
      key,
      limit,
      windowMs,
      maxAtomicRetries,
    });

    if (!result.allowed) {
      return rateLimitedResponse(ctx, {
        limit,
        remaining: 0,
        resetAt,
        retryAfterSeconds,
        includeHeaders,
      });
    }

    const response = await next();
    if (includeHeaders) {
      setRateLimitHeaders(response.headers, {
        limit,
        remaining: limit - result.used,
        resetAt,
      });
    }

    return response;
  };
}

function normalizePositiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive integer.`);
  }
  return value;
}

async function resolveIdentifier(
  ctx: Context,
  identifier?: (ctx: Context) => string | Promise<string>,
): Promise<string> {
  const value = identifier
    ? await identifier(ctx)
    : defaultIpIdentifier(ctx.request);
  return value.trim() || "anonymous";
}

function defaultIpIdentifier(request: Request): string {
  const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflareIp) return cloudflareIp;

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwardedFor = request.headers.get("x-forwarded-for")
    ?.split(",", 1)[0]
    .trim();
  if (forwardedFor) return forwardedFor;

  return "anonymous";
}

async function consumeToken(options: {
  readonly kv: Deno.Kv;
  readonly key: Deno.KvKey;
  readonly limit: number;
  readonly windowMs: number;
  readonly maxAtomicRetries: number;
}): Promise<{ allowed: true; used: number } | { allowed: false }> {
  for (let attempt = 0; attempt <= options.maxAtomicRetries; attempt++) {
    const entry = await options.kv.get<number>(options.key);
    const current = entry.value ?? 0;

    if (current >= options.limit) return { allowed: false };

    const next = current + 1;
    const commit = await options.kv.atomic()
      .check(entry)
      .set(options.key, next, { expireIn: Math.ceil(options.windowMs * 1.1) })
      .commit();

    if (commit.ok) return { allowed: true, used: next };
  }

  return { allowed: false };
}

function rateLimitedResponse(
  ctx: Context,
  options: {
    readonly limit: number;
    readonly remaining: number;
    readonly resetAt: number;
    readonly retryAfterSeconds: number;
    readonly includeHeaders: boolean;
  },
): Response {
  const error = new HttpError(
    HttpStatus.TOO_MANY_REQUESTS,
    "Too many requests",
    "rate_limit_exceeded",
  );
  const headers = new Headers();

  if (options.includeHeaders) {
    setRateLimitHeaders(headers, options);
    headers.set("retry-after", String(options.retryAfterSeconds));
  }

  return json(errorResponse(error, ctx.request), {
    status: HttpStatus.TOO_MANY_REQUESTS,
    headers,
  });
}

function setRateLimitHeaders(
  headers: Headers,
  options: {
    readonly limit: number;
    readonly remaining: number;
    readonly resetAt: number;
  },
): void {
  headers.set("x-ratelimit-limit", String(options.limit));
  headers.set("x-ratelimit-remaining", String(Math.max(0, options.remaining)));
  headers.set("x-ratelimit-reset", String(Math.ceil(options.resetAt / 1_000)));
}

function secondsUntil(resetAt: number, timestamp: number): number {
  return Math.max(1, Math.ceil((resetAt - timestamp) / 1_000));
}
