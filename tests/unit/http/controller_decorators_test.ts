import { assertEquals } from "@std/assert";
import {
  Box,
  Controller,
  createApp,
  Get,
  HttpStatus,
  Post,
  Repository,
  Service,
  z,
} from "../../../src/mod.ts";
import type { Body, Param, Query } from "../../../src/mod.ts";
import {
  getControllerPath,
} from "../../../src/presentation/controllers/controller-metadata-store.ts";

const UserIdParams = z.object({ id: z.string().min(1) });
const CreateUserBody = z.object({ name: z.string().min(1) });
const ListUsersQuery = z.object({ search: z.string().optional() });

type UserIdParams = z.infer<typeof UserIdParams>;
type CreateUserBody = z.infer<typeof CreateUserBody>;
type ListUsersQuery = z.infer<typeof ListUsersQuery>;

@Controller()
class UsersController {
  @Get(":id", {
    request: {
      params: UserIdParams,
    },
    responses: {
      200: z.object({ id: z.string(), name: z.string() }),
    },
  })
  public findById(input: Param<UserIdParams>): { id: string; name: string } {
    return { id: input.params.id, name: "Ada" };
  }

  @Get("/")
  public list(input: Query<ListUsersQuery>): { search?: string } {
    return { search: input.query.search };
  }

  @Post("/", {
    status: 201,
    request: {
      body: CreateUserBody,
    },
    responses: {
      201: z.object({ id: z.string(), name: z.string() }),
    },
  })
  public create(input: Body<CreateUserBody>): { id: string; name: string } {
    return { id: "user_1", name: input.body.name };
  }
}

@Controller("/admin/users")
class AdminUsersController {
  @Get()
  public list(): Array<{ id: string }> {
    return [{ id: "admin_1" }];
  }
}

@Controller()
class HTTPServerController {
  @Get()
  public status(): { ok: true } {
    return { ok: true };
  }
}

Deno.test("HTTP: controller decorators infer the route prefix and wrap DTOs as JSON", async () => {
  const app = createApp({
    controllers: [UsersController],
  });

  const response = await app.fetch(new Request("http://localhost/users/42"));

  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("content-type"),
    "application/json; charset=utf-8",
  );
  assertEquals(await response.json(), { id: "42", name: "Ada" });
});

Deno.test("HTTP: method decorators preserve route options for validation, status, and documentation", async () => {
  const app = createApp({
    controllers: [UsersController],
    docs: {},
  });

  const response = await app.fetch(
    new Request("http://localhost/users", {
      method: "POST",
      body: JSON.stringify({ name: "Grace" }),
      headers: { "content-type": "application/json" },
    }),
  );

  assertEquals(response.status, 201);
  assertEquals(await response.json(), { id: "user_1", name: "Grace" });

  const openApiResponse = await app.fetch(
    new Request("http://localhost/openapi.json"),
  );
  const openApi = await openApiResponse.json();

  assertEquals(openApi.paths["/users"].post.requestBody.required, true);
  assertEquals(
    openApi.paths["/users"].post.responses["201"].description,
    "Response",
  );
});

Deno.test("HTTP: controller decorator accepts an explicit prefix when inference is not enough", async () => {
  const app = createApp({
    controllers: [AdminUsersController],
  });

  const response = await app.fetch(new Request("http://localhost/admin/users"));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), [{ id: "admin_1" }]);
});

Deno.test("HTTP: controller decorators infer acronym-heavy names without regex backtracking", async () => {
  const app = createApp({
    controllers: [HTTPServerController],
  });

  const response = await app.fetch(new Request("http://localhost/http-server"));

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { ok: true });
});

Deno.test("HTTP: controller path inference preserves whole-string lowercase behavior", () => {
  const controller = {};

  Object.defineProperty(controller, "constructor", {
    value: { name: "AΣController" },
  });

  assertEquals(getControllerPath(controller), "/aς");
});

Deno.test("HTTP: controller path inference handles long class names in linear time", () => {
  const longName = `${"A".repeat(10_000)}Controller`;
  const controller = {};

  Object.defineProperty(controller, "constructor", {
    value: { name: longName },
  });

  assertEquals(getControllerPath(controller), `/${"a".repeat(10_000)}`);
});

@Repository()
class DecoratedUsersRepository {
  private static instanceCount = 0;

  public static get instances(): number {
    return DecoratedUsersRepository.instanceCount;
  }

  public static resetInstances(): void {
    DecoratedUsersRepository.instanceCount = 0;
  }

  public constructor() {
    DecoratedUsersRepository.instanceCount += 1;
  }

  public findName(id: string): string {
    return `User ${id}`;
  }
}

@Service()
class DecoratedUsersService {
  public static readonly inject = [DecoratedUsersRepository] as const;
  private static instanceCount = 0;

  public static get instances(): number {
    return DecoratedUsersService.instanceCount;
  }

  public static resetInstances(): void {
    DecoratedUsersService.instanceCount = 0;
  }

  public constructor(private readonly users: DecoratedUsersRepository) {
    DecoratedUsersService.instanceCount += 1;
  }

  public find(id: string): { id: string; name: string } {
    return { id, name: this.users.findName(id) };
  }
}

@Controller("/decorated-di-users")
class DecoratedDiUsersController {
  public static readonly inject = [DecoratedUsersService] as const;
  private static instanceCount = 0;

  public static get instances(): number {
    return DecoratedDiUsersController.instanceCount;
  }

  public static resetInstances(): void {
    DecoratedDiUsersController.instanceCount = 0;
  }

  public constructor(private readonly users: DecoratedUsersService) {
    DecoratedDiUsersController.instanceCount += 1;
  }

  @Get(":id", {
    request: {
      params: UserIdParams,
    },
  })
  public find(input: Param<UserIdParams>): { id: string; name: string } {
    return this.users.find(input.params.id);
  }
}

Deno.test("HTTP: createApp resolves decorated services and repositories as constructor singletons", async () => {
  DecoratedUsersRepository.resetInstances();
  DecoratedUsersService.resetInstances();
  DecoratedDiUsersController.resetInstances();

  const app = createApp({
    controllers: [DecoratedDiUsersController],
    services: [DecoratedUsersService],
    repositories: [DecoratedUsersRepository],
  });

  const first = await app.fetch(
    new Request("http://localhost/decorated-di-users/42"),
  );
  const second = await app.fetch(
    new Request("http://localhost/decorated-di-users/7"),
  );

  assertEquals(first.status, 200);
  assertEquals(await first.json(), { id: "42", name: "User 42" });
  assertEquals(second.status, 200);
  assertEquals(await second.json(), { id: "7", name: "User 7" });
  assertEquals(DecoratedUsersRepository.instances, 1);
  assertEquals(DecoratedUsersService.instances, 1);
  assertEquals(DecoratedDiUsersController.instances, 1);
});

@Repository()
class DecoratorOptionsClockRepository {
  public prefix(): string {
    return "Option User";
  }
}

@Repository({ deps: [DecoratorOptionsClockRepository] })
class DecoratorOptionsUsersRepository {
  public constructor(private readonly clock: DecoratorOptionsClockRepository) {}

  public findName(id: string): string {
    return `${this.clock.prefix()} ${id}`;
  }
}

@Service({ deps: [DecoratorOptionsUsersRepository] })
class DecoratorOptionsUsersService {
  public constructor(private readonly users: DecoratorOptionsUsersRepository) {}

  public find(id: string): { id: string; name: string } {
    return { id, name: this.users.findName(id) };
  }
}

@Controller("/decorator-option-di-users", {
  deps: [DecoratorOptionsUsersService],
})
class DecoratorOptionsDiUsersController {
  public constructor(private readonly users: DecoratorOptionsUsersService) {}

  @Get(":id", {
    request: {
      params: UserIdParams,
    },
  })
  public find(input: Param<UserIdParams>): { id: string; name: string } {
    return this.users.find(input.params.id);
  }
}

Deno.test("HTTP: DI dependencies can be declared in decorator options", async () => {
  const app = createApp({
    controllers: [DecoratorOptionsDiUsersController],
    services: [DecoratorOptionsUsersService],
    repositories: [
      DecoratorOptionsClockRepository,
      DecoratorOptionsUsersRepository,
    ],
  });

  const response = await app.fetch(
    new Request("http://localhost/decorator-option-di-users/42"),
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { id: "42", name: "Option User 42" });
});

class ProviderGreetingConfig {
  public constructor(public readonly prefix: string) {}
}

class ProviderClock {
  public now(): string {
    return "base";
  }
}

class ProviderSystemClock extends ProviderClock {
  private static instanceCount = 0;

  public static get instances(): number {
    return ProviderSystemClock.instanceCount;
  }

  public static resetInstances(): void {
    ProviderSystemClock.instanceCount = 0;
  }

  public constructor() {
    super();
    ProviderSystemClock.instanceCount += 1;
  }

  public override now(): string {
    return "2026";
  }
}

class ProviderSuffix {
  public constructor(public readonly value: string) {}
}

@Repository({
  deps: [ProviderGreetingConfig, ProviderClock, ProviderSuffix],
})
class CustomProviderUsersRepository {
  public constructor(
    private readonly config: ProviderGreetingConfig,
    private readonly clock: ProviderClock,
    private readonly suffix: ProviderSuffix,
  ) {}

  public findName(id: string): string {
    return `${this.config.prefix} ${id} ${this.clock.now()} ${this.suffix.value}`;
  }
}

@Service({ deps: [CustomProviderUsersRepository] })
class CustomProviderUsersService {
  public constructor(private readonly users: CustomProviderUsersRepository) {}

  public find(id: string): { id: string; name: string } {
    return { id, name: this.users.findName(id) };
  }
}

@Controller("/custom-provider-users", { deps: [CustomProviderUsersService] })
class CustomProviderUsersController {
  public constructor(private readonly users: CustomProviderUsersService) {}

  @Get(":id", {
    request: {
      params: UserIdParams,
    },
  })
  public find(input: Param<UserIdParams>): { id: string; name: string } {
    return this.users.find(input.params.id);
  }
}

Deno.test("HTTP: createApp supports value, class, and factory providers", async () => {
  ProviderSystemClock.resetInstances();

  const app = createApp({
    controllers: [CustomProviderUsersController],
    providers: [
      {
        provide: ProviderGreetingConfig,
        useValue: new ProviderGreetingConfig("Provider User"),
      },
      { provide: ProviderClock, useClass: ProviderSystemClock },
      {
        deps: [ProviderClock],
        provide: ProviderSuffix,
        useFactory: (clock: ProviderClock) => new ProviderSuffix(clock.now()),
      },
    ],
    repositories: [CustomProviderUsersRepository],
    services: [CustomProviderUsersService],
  });

  const first = await app.fetch(
    new Request("http://localhost/custom-provider-users/42"),
  );
  const second = await app.fetch(
    new Request("http://localhost/custom-provider-users/7"),
  );

  assertEquals(first.status, 200);
  assertEquals(await first.json(), {
    id: "42",
    name: "Provider User 42 2026 2026",
  });
  assertEquals(second.status, 200);
  assertEquals(await second.json(), {
    id: "7",
    name: "Provider User 7 2026 2026",
  });
  assertEquals(ProviderSystemClock.instances, 1);
});

@Controller("/auto-doc-users")
class AutoDocUsersController {
  @Get(":id", {
    summary: "Find user by id",
    responses: {
      [HttpStatus.OK]: { description: "User found" },
      [HttpStatus.NOT_FOUND]: { description: "User not found" },
    },
  })
  public findById(input: Param<{ id: string }>): { id: string } {
    return { id: input.params.id };
  }
}

Deno.test("HTTP: endpoint decorators infer operationId, tags, and basic params", async () => {
  const app = createApp({
    controllers: [AutoDocUsersController],
    docs: { enabled: true, title: "Auto Docs" },
  });

  const routeResponse = await app.fetch(
    new Request("http://localhost/auto-doc-users/42"),
  );
  assertEquals(routeResponse.status, Box.HttpStatus.OK);
  assertEquals(await routeResponse.json(), { id: "42" });

  const openApiResponse = await app.fetch(
    new Request("http://localhost/openapi.json"),
  );
  const document = await openApiResponse.json();
  const operation = document.paths["/auto-doc-users/{id}"].get;

  assertEquals(operation.operationId, "findById");
  assertEquals(operation.tags, ["AutoDocUsers"]);
  assertEquals(
    operation.parameters.map((parameter: { name: string; in: string }) => ({
      name: parameter.name,
      in: parameter.in,
    })),
    [{ name: "id", in: "path" }],
  );
  assertEquals(
    operation.responses[String(HttpStatus.OK)].description,
    "User found",
  );
});
