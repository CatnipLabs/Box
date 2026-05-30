import type { FetchHandler } from "../../application/runtime/index.ts";

type ServeRuntime<TServer> = {
  serve(
    options: Deno.ServeOptions,
    handler: (request: Request) => Response | Promise<Response>,
  ): TServer;
};

export function serve(
  app: FetchHandler,
  options?: Deno.ServeOptions,
): Deno.HttpServer<Deno.NetAddr> {
  return serveWithRuntime(app, options, Deno);
}

export function serveWithRuntime<TServer>(
  app: FetchHandler,
  options: Deno.ServeOptions = {},
  runtime: ServeRuntime<TServer>,
): TServer {
  return runtime.serve(options, (request: Request) => app.fetch(request));
}
