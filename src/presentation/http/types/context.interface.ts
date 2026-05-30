import type { BodyReadOptions } from "./body-read-options.interface.ts";
import type { Params } from "./params.type.ts";
import type { State } from "./state.type.ts";
import type { ValidatedRequest } from "./validated-request.interface.ts";

export interface Context {
  request: Request;
  url: URL;
  params: Params;
  query: URLSearchParams;
  state: State;
  validated: ValidatedRequest;
  json<T = unknown>(options?: BodyReadOptions): Promise<T>;
  text(options?: BodyReadOptions): Promise<string>;
}
