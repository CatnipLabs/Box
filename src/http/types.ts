export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS"
  | "HEAD";

export type MaybePromise<T> = T | Promise<T>;

export type Params = Record<string, string>;
export type State = Record<string, unknown>;

export interface Context {
  request: Request;
  url: URL;
  params: Params;
  query: URLSearchParams;
  state: State;
  json<T = unknown>(options?: BodyReadOptions): Promise<T>;
  text(options?: BodyReadOptions): Promise<string>;
}

export interface BodyReadOptions {
  maxBytes?: number;
}

export type Handler = (ctx: Context) => MaybePromise<Response>;
export type Next = () => Promise<Response>;
export type Middleware = (ctx: Context, next: Next) => MaybePromise<Response>;

export interface FetchHandler {
  fetch(request: Request): Promise<Response>;
}
