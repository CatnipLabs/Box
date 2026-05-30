import { type Body, Box, type Param, z } from "../../src/mod.ts";

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

@Box.Repository()
class UsersRepository {
  private readonly users = new Map<string, User>();

  public findById(id: string): User | undefined {
    return this.users.get(id);
  }

  public create(input: CreateUserRequest): User {
    const user = { id: crypto.randomUUID(), name: input.name };
    this.users.set(user.id, user);
    return user;
  }
}

@Box.Service({ deps: [UsersRepository] })
class UsersService {
  public constructor(private readonly users: UsersRepository) {}

  public findById(id: string): User {
    const user = this.users.findById(id);

    if (!user) {
      throw new Box.HttpError(404, "User not found", "user_not_found");
    }

    return user;
  }

  public create(input: CreateUserRequest): User {
    return this.users.create(input);
  }
}

@Box.Controller("/users", { deps: [UsersService] })
class UsersController {
  public constructor(private readonly users: UsersService) {}

  @Box.Get(":id", {
    summary: "Find user by id",
    operationId: "findUserById",
    tags: ["Users"],
    request: { params: UserIdParams },
    responses: {
      200: { description: "User found", body: UserResponse },
      404: { description: "User not found" },
    },
  })
  public findById(input: Param<UserIdParams>): User {
    return this.users.findById(input.params.id);
  }

  @Box.Post("/", {
    status: 201,
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
  })
  public create(input: Body<CreateUserRequest>): User {
    return this.users.create(input.body);
  }
}

const app = Box.createApp({
  controllers: [UsersController],
  docs: {
    enabled: Deno.env.get("BOX_DOCS") !== "false",
    title: "Users API",
    version: "1.0.0",
    description: "Example REST API documented automatically by Box + Scalar.",
  },
  repositories: [UsersRepository],
  services: [UsersService],
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

export default {
  fetch: (request: Request) => app.fetch(request),
};
