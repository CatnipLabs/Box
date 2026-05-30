import { Box, z } from "../../src/mod.ts";

const UserIdParams = z.object({
  id: z.string().min(1),
});

const CreateUserRequest = z.object({
  name: z.string().min(1),
});

const UserResponse = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

type User = z.infer<typeof UserResponse>;
type CreateUserRequest = z.infer<typeof CreateUserRequest>;
type UserIdParams = z.infer<typeof UserIdParams>;

const users = new Map<string, User>();
const app = new Box.App({
  docs: {
    enabled: Deno.env.get("BOX_DOCS") !== "false",
    title: "Users API",
    version: "1.0.0",
    description: "Example REST API documented automatically by Box + Scalar.",
  },
});

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

app.get(
  "/users/:id",
  (ctx) => {
    const params = ctx.validated.params as UserIdParams;
    const user = users.get(params.id);

    if (!user) {
      throw new Box.HttpError(404, "User not found", "user_not_found");
    }

    return Box.json(user);
  },
  {
    summary: "Find user by id",
    operationId: "findUserById",
    tags: ["Users"],
    request: { params: UserIdParams },
    responses: {
      200: { description: "User found", body: UserResponse },
      404: { description: "User not found" },
    },
  },
);

app.post(
  "/users",
  (ctx) => {
    const body = ctx.validated.body as CreateUserRequest;
    const id = crypto.randomUUID();
    const user = { id, name: body.name };
    users.set(id, user);

    return Box.json(user, { status: 201 });
  },
  {
    summary: "Create user",
    operationId: "createUser",
    tags: ["Users"],
    request: {
      body: CreateUserRequest,
      bodyMaxBytes: 16_384,
    },
    responses: {
      201: { description: "User created", body: UserResponse },
    },
  },
);

export default {
  fetch: (request: Request) => app.fetch(request),
};
