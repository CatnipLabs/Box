import { Box } from "../../src/mod.ts";

interface User {
  id: string;
  name: string;
}

const users = new Map<string, User>();
const app = new Box.App();

app.use(async (_ctx, next) => {
  const startedAt = performance.now();
  const response = await next();
  response.headers.set(
    "x-response-time-ms",
    String(performance.now() - startedAt),
  );
  response.headers.set("x-powered-by", "box");
  return response;
});

app.get("/users/:id", (ctx) => {
  const user = users.get(ctx.params.id);

  if (!user) {
    throw new Box.HttpError(404, "User not found", "user_not_found");
  }

  return Box.json(user);
});

app.post("/users", async (ctx) => {
  const body = await ctx.json<{ name?: string }>({ maxBytes: 16_384 });

  if (!body.name) {
    throw Box.badRequest("User name is required", { field: "name" });
  }

  const id = crypto.randomUUID();
  const user = { id, name: body.name };
  users.set(id, user);

  return Box.json(user, { status: 201 });
});

export default {
  fetch: (request: Request) => app.fetch(request),
};
