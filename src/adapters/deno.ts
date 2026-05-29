import type { FetchHandler } from "../http/types.ts";

export function serve(
  app: FetchHandler,
  options?: Deno.ServeOptions,
): Deno.HttpServer<Deno.NetAddr> {
  return Deno.serve(options ?? {}, (request: Request) => app.fetch(request));
}
