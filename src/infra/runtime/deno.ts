import type { FetchHandler } from "../../application/runtime/index.ts";

export function serve(
  app: FetchHandler,
  options?: Deno.ServeOptions,
): Deno.HttpServer<Deno.NetAddr> {
  return Deno.serve(options ?? {}, (request: Request) => app.fetch(request));
}
