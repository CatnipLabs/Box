import { Box } from "../../src/mod.ts";

const app = new Box.App();

app.get("/health", () => Box.json({ ok: true }));
app.get("/hello/:name", (ctx) => Box.json({ hello: ctx.params.name }));

export default {
  fetch: (request: Request) => app.fetch(request),
};
