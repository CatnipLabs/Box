import { type Body, Box, type Param, z } from "../../src/mod.ts";

const CreateUserRequest = z.object({
  name: z.string().min(1),
});

const UserResponse = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

type User = z.infer<typeof UserResponse>;
type CreateUserRequest = z.infer<typeof CreateUserRequest>;
type UserIdParams = { id: string };

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
      throw new Box.HttpError(
        Box.HttpStatus.NOT_FOUND,
        "User not found",
        "user_not_found",
      );
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
    responses: {
      [Box.HttpStatus.OK]: { description: "User found", body: UserResponse },
      [Box.HttpStatus.NOT_FOUND]: { description: "User not found" },
    },
  })
  public findById(input: Param<UserIdParams>): User {
    return this.users.findById(input.params.id);
  }

  @Box.Post("/", {
    status: Box.HttpStatus.CREATED,
    summary: "Create user",
    request: {
      body: CreateUserRequest,
      bodyMaxBytes: 16_384,
    },
    responses: {
      [Box.HttpStatus.CREATED]: {
        description: "User created",
        body: UserResponse,
      },
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
