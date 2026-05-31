import { assert, assertEquals } from "@std/assert";
import {
  App,
  Controller,
  cors,
  Entity,
  HttpError,
  json,
  KvRepository,
  readJson,
  requestLogger,
  type RouteDefinition,
  secureHeaders,
  Service,
} from "../../src/mod.ts";
import { Levels, Logger } from "../../src/infra/logger/index.ts";
import type { LogRecord } from "../../src/infra/logger/index.ts";
import { MemoryKv } from "../fixtures/orm/memory_kv.ts";
import { registerController } from "../../src/presentation/http/app.ts";

interface TodoPayload {
  title?: string;
  priority?: number;
  tags?: string[];
}

interface TodoResponse {
  id: string;
  title: string;
  completed: boolean;
  priority: number;
  tags: string[];
}

interface ErrorResponse {
  success: false;
  error: {
    statusCode: number;
    code: string;
    message: string;
    details?: unknown;
    path: string;
    method: string;
    requestId?: string;
    timestamp: string;
  };
}

class Todo extends Entity<string> {
  public constructor(
    id: string,
    public readonly title: string,
    public readonly completed: boolean,
    public readonly priority: number,
    public readonly tags: string[] = [],
  ) {
    super(id);
  }

  public complete(): Todo {
    return new Todo(this.id, this.title, true, this.priority, this.tags);
  }

  public toJSON(): TodoResponse {
    return {
      id: this.id,
      title: this.title,
      completed: this.completed,
      priority: this.priority,
      tags: this.tags,
    };
  }
}

class TodoNotFound extends HttpError {
  public constructor(id: string) {
    super(404, "Todo not found", "todo_not_found", { id });
  }
}

class TodoService extends Service {
  private nextId = 1;

  public constructor(private readonly todos: KvRepository<Todo>) {
    super();
  }

  public async create(payload: TodoPayload): Promise<Todo> {
    if (!payload.title || payload.title.trim() === "") {
      throw new HttpError(400, "Title is required", "validation_error", {
        field: "title",
      });
    }

    const todo = new Todo(
      `todo-${this.nextId++}`,
      payload.title.trim(),
      false,
      payload.priority ?? 0,
      payload.tags ?? [],
    );

    return await this.todos.save(todo);
  }

  public async listOpen(): Promise<Todo[]> {
    return await this.todos
      .query()
      .where("completed", "eq", false)
      .orderBy("priority", "desc")
      .all();
  }

  public async complete(id: string): Promise<Todo> {
    const todo = await this.todos.findById(id);

    if (!todo) {
      throw new TodoNotFound(id);
    }

    return await this.todos.save(todo.complete());
  }
}

class TodoController extends Controller {
  public override readonly path = "/todos";

  public constructor(private readonly service: TodoService) {
    super();
  }

  public override routes(): RouteDefinition[] {
    return [
      this.post("/", async (ctx) => {
        const todo = await this.service.create(await readJson(ctx.request));
        return json(todo.toJSON(), { status: 201 });
      }),
      this.get("/", async () => {
        const todos = await this.service.listOpen();
        return json({ data: todos.map((todo) => todo.toJSON()) });
      }),
      this.patch("/:id/complete", async (ctx) => {
        const todo = await this.service.complete(ctx.params.id);
        return json(todo.toJSON());
      }),
    ];
  }
}

function createTodoApp(logs: LogRecord[]): App {
  const logger = new Logger({
    name: "TodoApi",
    level: Levels.INFO,
    sink: (record) => logs.push(record),
    clock: () => new Date("2026-01-01T00:00:00.000Z"),
  });
  const repository = new KvRepository(Todo, new MemoryKv(), {
    collection: "todos",
  });
  const service = new TodoService(repository);
  const controller = new TodoController(service);
  const app = new App();

  app.use(cors({ origin: "https://app.box.test", credentials: true }));
  app.use(secureHeaders());
  app.use(
    requestLogger({
      logger,
      now: deterministicClock([10, 13, 20, 24, 30, 35]),
    }),
  );
  registerController(app, controller);

  return app;
}

function deterministicClock(values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? values.at(-1) ?? 0;
}

async function jsonBody<T>(response: Response): Promise<T> {
  return await response.json() as T;
}

Deno.test("Integration: controller, service, repository, security and logs work end-to-end", async () => {
  const logs: LogRecord[] = [];
  const app = createTodoApp(logs);

  const firstCreate = await app.fetch(
    new Request("http://localhost/todos", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "origin": "https://app.box.test",
        "x-request-id": "req-create-1",
      },
      body: JSON.stringify({
        title: " Ship enterprise API framework ",
        priority: 10,
        tags: ["framework", "enterprise"],
      }),
    }),
  );

  assertEquals(firstCreate.status, 201);
  assertEquals(
    firstCreate.headers.get("access-control-allow-origin"),
    "https://app.box.test",
  );
  assertEquals(
    firstCreate.headers.get("access-control-allow-credentials"),
    "true",
  );
  assertEquals(firstCreate.headers.get("x-content-type-options"), "nosniff");
  assertEquals(await jsonBody<TodoResponse>(firstCreate), {
    id: "todo-1",
    title: "Ship enterprise API framework",
    completed: false,
    priority: 10,
    tags: ["framework", "enterprise"],
  });

  await app.fetch(
    new Request("http://localhost/todos", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Write docs", priority: 5 }),
    }),
  );

  const completed = await app.fetch(
    new Request("http://localhost/todos/todo-1/complete", {
      method: "PATCH",
      headers: { "x-request-id": "req-complete-1" },
    }),
  );

  assertEquals(completed.status, 200);
  assertEquals((await jsonBody<TodoResponse>(completed)).completed, true);

  const listOpen = await app.fetch(new Request("http://localhost/todos"));

  assertEquals(listOpen.status, 200);
  assertEquals(await jsonBody<{ data: TodoResponse[] }>(listOpen), {
    data: [{
      id: "todo-2",
      title: "Write docs",
      completed: false,
      priority: 5,
      tags: [],
    }],
  });

  assertEquals(logs.length, 4);
  assertEquals(logs[0].service, "TodoApi");
  assertEquals(logs[0].message, "HTTP request completed");
  assertEquals(logs[0].context?.method, "POST");
  assertEquals(logs[0].context?.path, "/todos");
  assertEquals(logs[0].context?.status, 201);
  assertEquals(logs[0].context?.durationMs, 3);
  assertEquals(logs[0].context?.requestId, "req-create-1");
});

Deno.test("Integration: custom exceptions use the universal error response contract", async () => {
  const logs: LogRecord[] = [];
  const app = createTodoApp(logs);

  const response = await app.fetch(
    new Request("http://localhost/todos/missing/complete", {
      method: "PATCH",
      headers: { "x-request-id": "req-missing-1" },
    }),
  );

  assertEquals(response.status, 404);
  const body = await jsonBody<ErrorResponse>(response);

  assertEquals(body.success, false);
  assertEquals(body.error.statusCode, 404);
  assertEquals(body.error.code, "todo_not_found");
  assertEquals(body.error.message, "Todo not found");
  assertEquals(body.error.details, { id: "missing" });
  assertEquals(body.error.path, "/todos/missing/complete");
  assertEquals(body.error.method, "PATCH");
  assertEquals(body.error.requestId, "req-missing-1");
  assert(!Number.isNaN(Date.parse(body.error.timestamp)));

  assertEquals(logs.length, 1);
  assertEquals(logs[0].message, "HTTP request failed");
  assertEquals(logs[0].context?.method, "PATCH");
  assertEquals(logs[0].context?.path, "/todos/missing/complete");
  assertEquals(logs[0].context?.durationMs, 3);
  assertEquals(logs[0].context?.requestId, "req-missing-1");
  assertEquals(logs[0].context?.error, {
    name: "HttpError",
    message: "Todo not found",
    code: "todo_not_found",
    status: 404,
  });
});
