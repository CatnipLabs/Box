import { readJson, readText } from "../body.ts";
import type { Context, State } from "../types.ts";

export function createContext(
  request: Request,
  url: URL,
  params: Record<string, string>,
  state: State = {},
): Context {
  const context: Context = {
    request,
    url,
    params,
    query: url.searchParams,
    state,
    validated: {},
    json: (options) => readJson(context.request, options),
    text: (options) => readText(context.request, options),
  };

  return context;
}
