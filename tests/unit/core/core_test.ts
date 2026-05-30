import { assertEquals, assertThrows } from "@std/assert";
import { App, json } from "../../../src/presentation/http/index.ts";
import { Controller } from "../../../src/presentation/controllers/controller.ts";
import { Entity } from "../../../src/domain/entities/entity.ts";
import { Repository } from "../../../src/domain/repositories/index.ts";
import type { EntityConstructor } from "../../../src/domain/repositories/index.ts";
import { Service } from "../../../src/application/services/service.ts";

async function bodyJson<T>(response: Response): Promise<T> {
  return await response.json() as T;
}

class User extends Entity<string> {
  public constructor(
    id: string,
    public readonly name: string,
  ) {
    super(id);
  }
}

class UsersRepository extends Repository<User> {
  public constructor() {
    super(User);
  }

  public findById(id: string): User | undefined {
    if (id !== "42") return undefined;
    return new User(id, "Ada");
  }
}

class UsersService extends Service {
  public constructor(private readonly repository: UsersRepository) {
    super();
  }

  public getById(id: string): User | undefined {
    return this.repository.findById(id);
  }
}

class UsersController extends Controller {
  public override readonly path = "/users";

  public constructor(private readonly service: UsersService) {
    super();
  }

  public override routes() {
    return [
      this.get(":id", (ctx) => {
        const user = this.service.getById(ctx.params.id);
        return json({ id: user?.id, name: user?.name });
      }),
      this.post("/", () => json({ created: true }, { status: 201 })),
    ];
  }
}

Deno.test("Core: app.controller registra rotas de controller com prefixo", async () => {
  const app = new App();
  const controller = new UsersController(
    new UsersService(new UsersRepository()),
  );

  app.controller(controller);

  const response = await app.fetch(new Request("http://localhost/users/42"));

  assertEquals(response.status, 200);
  assertEquals(await bodyJson(response), { id: "42", name: "Ada" });
});

Deno.test("Core: controller normaliza prefixo e path das rotas", async () => {
  const app = new App();
  const controller = new UsersController(
    new UsersService(new UsersRepository()),
  );

  app.controller(controller);

  const response = await app.fetch(
    new Request("http://localhost/users", { method: "POST" }),
  );

  assertEquals(response.status, 201);
  assertEquals(await bodyJson(response), { created: true });
});

Deno.test("Core: Repository exige Entity base", () => {
  assertEquals(new UsersRepository().entityName, "User");

  class NotAnEntity {}

  assertThrows(
    () => new Repository(NotAnEntity as unknown as EntityConstructor),
    TypeError,
    "Repository entity must extend Entity",
  );
});
