import { assertEquals } from "@std/assert";
import { serve, serveWithRuntime } from "../../../src/infra/runtime/deno.ts";

Deno.test("Deno adapter: serveWithRuntime delegates requests to app.fetch", async () => {
  const calls: string[] = [];
  const app = {
    async fetch(request: Request): Promise<Response> {
      calls.push(request.url);
      await Promise.resolve();
      return new Response("ok", { status: 201 });
    },
  };
  const runtime = {
    serve(
      options: Deno.ServeOptions,
      handler: (request: Request) => Response | Promise<Response>,
    ) {
      assertEquals((options as { port?: number }).port, 4507);
      return { handler };
    },
  };

  const server = serveWithRuntime(
    app,
    { port: 4507 } as Deno.ServeOptions,
    runtime,
  );
  const response = await server.handler(new Request("http://localhost/hello"));

  assertEquals(response.status, 201);
  assertEquals(await response.text(), "ok");
  assertEquals(calls, ["http://localhost/hello"]);
});

Deno.test("Deno adapter: serve is exported as a public function", () => {
  assertEquals(typeof serve, "function");
});
