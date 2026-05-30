import type { Context } from "../http/types.ts";
import type { RequestInput } from "./request-input.interface.ts";

export function createRouteInput(ctx: Context): RequestInput {
  return {
    body: ctx.validated.body,
    query: (ctx.validated.query ?? queryToObject(ctx.query)) as Record<
      string,
      string | string[]
    >,
    params: (ctx.validated.params ?? ctx.params) as Record<string, string>,
    headers:
      (ctx.validated.headers ?? headersToObject(ctx.request.headers)) as Record<
        string,
        string
      >,
  };
}

function queryToObject(
  query: URLSearchParams,
): Record<string, string | string[]> {
  const value: Record<string, string | string[]> = {};

  for (const [key, entry] of query.entries()) {
    const current = value[key];

    if (current === undefined) {
      value[key] = entry;
      continue;
    }

    value[key] = Array.isArray(current)
      ? [...current, entry]
      : [current, entry];
  }

  return value;
}

function headersToObject(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries());
}
