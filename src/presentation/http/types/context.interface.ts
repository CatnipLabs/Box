import type { BodyReadOptions } from "./body-read-options.interface.ts";
import type { Params } from "./params.type.ts";
import type { State } from "./state.type.ts";

export interface Context {
  request: Request;
  url: URL;
  params: Params;
  query: URLSearchParams;
  state: State;
  json<T = unknown>(options?: BodyReadOptions): Promise<T>;
  text(options?: BodyReadOptions): Promise<string>;
}
