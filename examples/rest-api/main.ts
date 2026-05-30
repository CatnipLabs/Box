import {
  type AuthStrategyContract,
  type Body,
  Box,
  type Context,
  type Param,
  z,
} from "../../src/mod.ts";

const CreateUserRequest = z.object({
  name: z.string().min(1),
});

const UserResponse = z.object({
  id: z.string().uuid(),
  name: z.string(),
});

const UserIdParams = z.object({
  id: z.string().uuid(),
});

type User = z.infer<typeof UserResponse>;
type CreateUserRequest = z.infer<typeof CreateUserRequest>;
type UserIdParams = z.infer<typeof UserIdParams>;

@Box.Service()
class TokenService {
  public resolveUserId(authorization: string | null): string | undefined {
    const token = authorization?.replace(/^Bearer\s+/i, "");
    return token === "valid-jwt" ? "user_1" : undefined;
  }
}

@Box.AuthStrategy({ name: "jwt", deps: [TokenService] })
class JwtAuthStrategy implements AuthStrategyContract {
  public constructor(private readonly tokens: TokenService) {}

  public validate(ctx: Context): boolean {
    const userId = this.tokens.resolveUserId(
      ctx.request.headers.get("authorization"),
    );

    if (!userId) return false;

    ctx.state.userId = userId;
    return true;
  }
}

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
    request: { params: UserIdParams },
    responses: {
      [Box.HttpStatus.OK]: { description: "User found", body: UserResponse },
      [Box.HttpStatus.NOT_FOUND]: { description: "User not found" },
    },
  })
  public findById(input: Param<UserIdParams>): User {
    return this.users.findById(input.params.id);
  }

  @Box.Post("/", {
    auth: "jwt",
    status: Box.HttpStatus.CREATED,
    summary: "Create user",
    request: {
      body: CreateUserRequest,
      bodyMaxBytes: Box.RequestSizeLimit.KB16,
    },
    responses: {
      [Box.HttpStatus.CREATED]: {
        description: "User created",
        body: UserResponse,
      },
      [Box.HttpStatus.UNAUTHORIZED]: {
        description: "Missing or invalid bearer token",
      },
    },
  })
  public create(input: Body<CreateUserRequest>): User {
    return this.users.create(input.body);
  }
}

const logger = new Box.Log.Logger({ name: "rest-api" });

const app = Box.createApp({
  authStrategies: [JwtAuthStrategy],
  controllers: [UsersController],
  docs: {
    enabled: true,
    title: "Users API",
    version: "1.0.0",
    description: "Example REST API documented automatically by Box + Scalar.",
  },
  repositories: [UsersRepository],
  services: [TokenService, UsersService],
});

app.use(Box.secureHeaders());
app.use(Box.cors({ origin: ["https://app.example.com"] }));
app.use(Box.payloadLimit({
  jsonMaxBytes: Box.RequestSizeLimit.MB1,
  defaultMaxBytes: Box.RequestSizeLimit.MB1,
}));
app.use(Box.requestTime());
app.use(Box.requestLogger({ logger }));

export default {
  fetch: (request: Request) => app.fetch(request),
};
