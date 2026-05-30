import { readJson, readText } from "../body.ts";
import type { Context, State } from "../types.ts";

export function createContext(
  request: Request,
  url: URL,
  params: Record<string, string>,
  state: State = {},
): Context {
  return {
    request,
    url,
    params,
    query: url.searchParams,
    state,
    validated: {},
    json: (options) => readJson(request, options),
    text: (options) => readText(request, options),
  };
}
