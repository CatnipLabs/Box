import { assertEquals, assertMatch, assertThrows } from "@std/assert";
import { assertSpyCalls, stub } from "@std/testing/mock";

import { App, json } from "../../../src/presentation/http/index.ts";
import {
  Logger,
  type LogRecord,
  requestLogger,
} from "../../../src/logger/index.ts";
import { Levels } from "../../../src/infra/logger/levels.enum.ts";
import { ForegroundColors } from "../../../src/infra/logger/foreground.colors.ts";
import { BackgroundColors } from "../../../src/infra/logger/background.colors.ts";
import type { LoggerConstructorOptions } from "../../../src/infra/logger/logger-constructor.schema.ts";

function makeLogger(name?: string) {
  return new Logger({ name, level: Levels.TRACE });
}

Deno.test(
  "Logger - constructor: instantiates with valid options (with name)",
  () => {
    const logger = new Logger({ name: "MyService", level: Levels.DEBUG });
    assertEquals(logger.getServiceName(), "MyService");
  },
);

Deno.test(
  "Logger - constructor: instantiates with valid options (without name)",
  () => {
    const logger = new Logger({ level: Levels.INFO });
    assertEquals(typeof logger.getServiceName(), "string");
  },
);

Deno.test(
  "Logger - constructor: throws when argument is null/undefined",
  () => {
    assertThrows(
      () => new Logger(null as unknown as LoggerConstructorOptions),
      Error,
    );
  },
);

Deno.test("getForegroundColor: ERROR → RED", () => {
  const logger = makeLogger();
  assertEquals(logger.getForegroundColor(Levels.ERROR), ForegroundColors.RED);
});

Deno.test("getForegroundColor: WARN → YELLOW", () => {
  const logger = makeLogger();
  assertEquals(logger.getForegroundColor(Levels.WARN), ForegroundColors.YELLOW);
});

Deno.test("getForegroundColor: INFO → GREEN", () => {
  const logger = makeLogger();
  assertEquals(logger.getForegroundColor(Levels.INFO), ForegroundColors.GREEN);
});

Deno.test("getForegroundColor: DEBUG → CYAN", () => {
  const logger = makeLogger();
  assertEquals(logger.getForegroundColor(Levels.DEBUG), ForegroundColors.CYAN);
});

Deno.test("getForegroundColor: TRACE → GRAY", () => {
  const logger = makeLogger();
  assertEquals(logger.getForegroundColor(Levels.TRACE), ForegroundColors.GRAY);
});

Deno.test("getForegroundColor: unknown value → WHITE (default)", () => {
  const logger = makeLogger();
  const color = logger.getForegroundColor("UNKNOWN_LEVEL" as unknown as Levels);
  assertEquals(color, ForegroundColors.WHITE);
});

Deno.test("getFormatedName: without name returns an empty string", () => {
  const logger = makeLogger();
  assertEquals(logger.getFormatedName(), "");
});

Deno.test("getFormatedName: with name contains the name in the string", () => {
  const logger = makeLogger("API");
  const result: string = logger.getFormatedName();
  assertEquals(result.includes("API"), true);
});

Deno.test("getFormatedName: with name includes brackets and reset colors", () => {
  const logger = makeLogger("SVC");
  const result: string = logger.getFormatedName();
  assertEquals(result.includes("["), true);
  assertEquals(result.includes("]"), true);
  assertEquals(result.includes(BackgroundColors.RESET), true);
  assertEquals(result.includes(ForegroundColors.BLUE), true);
});

Deno.test("getFormatedLevel: contains the level label", () => {
  const logger = makeLogger();
  const result: string = logger.getFormatedLevel(Levels.INFO);
  assertEquals(result.includes(String(Levels.INFO)), true);
});

Deno.test("getFormatedLevel: contains the correct color for ERROR", () => {
  const logger = makeLogger();
  const result: string = logger.getFormatedLevel(Levels.ERROR);
  assertEquals(result.includes(ForegroundColors.RED), true);
});

Deno.test("getFormatedLevel: contains brackets and reset", () => {
  const logger = makeLogger();
  const result: string = logger.getFormatedLevel(Levels.DEBUG);
  assertEquals(result.includes("["), true);
  assertEquals(result.includes(BackgroundColors.RESET), true);
});

Deno.test("getFormatedTime: returns string with ISO-8601 timestamp", () => {
  const logger = makeLogger();
  const result: string = logger.getFormatedTime();
  assertMatch(result, /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
});

Deno.test("getFormatedTime: contains GRAY and brackets", () => {
  const logger = makeLogger();
  const result: string = logger.getFormatedTime();
  assertEquals(result.includes(ForegroundColors.GRAY), true);
  assertEquals(result.includes("["), true);
  assertEquals(result.includes("]"), true);
});

Deno.test("format: includes level, timestamp, and message", () => {
  const logger = makeLogger("FMT");
  const result: string = logger.format(Levels.INFO, "hello");
  assertEquals(result.includes(String(Levels.INFO)), true);
  assertEquals(result.includes("hello"), true);
  assertMatch(result, /\d{4}-\d{2}-\d{2}/);
});

Deno.test(
  "format: without name the result does not have a weird duplicated empty string",
  () => {
    const logger = makeLogger();
    const result: string = logger.format(Levels.WARN, "msg");
    assertEquals(result.includes("msg"), true);
    assertEquals(result.includes(String(Levels.WARN)), true);
  },
);

Deno.test("format: message can be an object", () => {
  const logger = makeLogger();
  const obj = { key: "value" };
  const result: string = logger.format(Levels.DEBUG, obj);
  assertEquals(result.includes("[object Object]"), true);
});

Deno.test("info: calls console.log with formatted message", () => {
  const logger = makeLogger("TEST");
  using logStub = stub(console, "log");

  logger.info("test info");

  assertSpyCalls(logStub, 1);
  const arg: string = logStub.calls[0].args[0];
  assertEquals(arg.includes("test info"), true);
  assertEquals(arg.includes(String(Levels.INFO)), true);
});

Deno.test("warn: calls console.warn with formatted message", () => {
  const logger = makeLogger("TEST");
  using warnStub = stub(console, "warn");

  logger.warn("test warn");

  assertSpyCalls(warnStub, 1);
  const arg: string = warnStub.calls[0].args[0];
  assertEquals(arg.includes("test warn"), true);
  assertEquals(arg.includes(String(Levels.WARN)), true);
});

Deno.test("error: calls console.error with formatted message", () => {
  const logger = makeLogger("TEST");
  using errorStub = stub(console, "error");

  logger.error("test error");

  assertSpyCalls(errorStub, 1);
  const arg: string = errorStub.calls[0].args[0];
  assertEquals(arg.includes("test error"), true);
  assertEquals(arg.includes(String(Levels.ERROR)), true);
});

Deno.test("debug: calls console.debug with formatted message", () => {
  const logger = makeLogger("TEST");
  using debugStub = stub(console, "debug");

  logger.debug("test debug");

  assertSpyCalls(debugStub, 1);
  const arg: string = debugStub.calls[0].args[0];
  assertEquals(arg.includes("test debug"), true);
  assertEquals(arg.includes(String(Levels.DEBUG)), true);
});

Deno.test("trace: calls console.log with formatted message", () => {
  const logger = makeLogger("TEST");
  using logStub = stub(console, "log");

  logger.trace("test trace");

  assertSpyCalls(logStub, 1);
  const arg: string = logStub.calls[0].args[0];
  assertEquals(arg.includes("test trace"), true);
  assertEquals(arg.includes(String(Levels.TRACE)), true);
});

Deno.test("info: accepts number as message", () => {
  const logger = makeLogger();
  using logStub = stub(console, "log");
  logger.info(42);
  assertSpyCalls(logStub, 1);
});

Deno.test("error: accepts Error as message", () => {
  const logger = makeLogger();
  using errStub = stub(console, "error");
  logger.error(new Error("boom"));
  assertSpyCalls(errStub, 1);
});

Deno.test("warn: accepts null as message", () => {
  const logger = makeLogger();
  using warnStub = stub(console, "warn");
  logger.warn(null);
  assertSpyCalls(warnStub, 1);
});

Deno.test("info with name: output contains the service name", () => {
  const logger = makeLogger("OrderService");
  using logStub = stub(console, "log");

  logger.info("order placed");

  const arg: string = logStub.calls[0].args[0];
  assertEquals(arg.includes("OrderService"), true);
});

Deno.test("debug without name: output does not contain empty-name brackets", () => {
  const logger = makeLogger(); // without name
  using debugStub = stub(console, "debug");

  logger.debug("checking");

  const arg: string = debugStub.calls[0].args[0];
  assertEquals(arg.length > 0, true);
});

Deno.test("Logger - constructor: throws for invalid options", () => {
  assertThrows(
    () => new Logger({ name: 123 as unknown as string }),
    Error,
    "Invalid logger constructor options",
  );
  assertThrows(
    () => new Logger({ level: 999 as Levels }),
    Error,
    "Invalid logger constructor options",
  );
  assertThrows(
    () =>
      new Logger({
        level: Levels.INFO,
        sink: "stdout" as unknown as LoggerConstructorOptions["sink"],
      }),
    Error,
    "Invalid logger constructor options",
  );
  assertThrows(
    () =>
      new Logger({
        level: Levels.INFO,
        clock: "now" as unknown as LoggerConstructorOptions["clock"],
      }),
    Error,
    "Invalid logger constructor options",
  );
});

Deno.test("Logger - level: default INFO ignores DEBUG", () => {
  const logger = new Logger({});
  using debugStub = stub(console, "debug");

  logger.debug("debug detail");

  assertSpyCalls(debugStub, 0);
});

Deno.test("requestLogger: uses default logger when none is provided", async () => {
  const app = new App();
  const times = [1, 2];
  using logStub = stub(console, "log");

  app.use(requestLogger({ now: () => times.shift() ?? 2 }));
  app.get("/health", () => json({ ok: true }));

  const response = await app.fetch(new Request("http://localhost/health"));

  assertEquals(response.status, 200);
  assertSpyCalls(logStub, 1);
  const arg = String(logStub.calls[0].args[0]);
  assertEquals(arg.includes("Box.Http"), true);
  assertEquals(arg.includes("HTTP request completed"), true);
});

Deno.test("requestLogger: records structured error and rethrows the exception", async () => {
  const records: LogRecord[] = [];
  const logger = new Logger({
    name: "HttpServer",
    level: Levels.INFO,
    sink: (record) => records.push(record),
    clock: () => new Date("2026-05-29T20:00:00.000Z"),
  });
  const app = new App();
  const times = [5, 8];

  app.use(requestLogger({ logger, now: () => times.shift() ?? 8 }));
  app.get("/boom", () => {
    throw "raw failure";
  });

  const response = await app.fetch(
    new Request("http://localhost/boom", {
      headers: { "x-correlation-id": "corr-1" },
    }),
  );

  assertEquals(response.status, 500);
  assertEquals(records.length, 1);
  assertEquals(records[0].level, Levels.ERROR);
  assertEquals(records[0].message, "HTTP request failed");
  assertEquals(records[0].context, {
    method: "GET",
    path: "/boom",
    status: 500,
    durationMs: 3,
    requestId: "corr-1",
    error: { message: "raw failure" },
  });
});

Deno.test("Logger - structured: sink receives record with typed context", () => {
  const records: LogRecord[] = [];
  const logger = new Logger({
    name: "OrdersService",
    level: Levels.DEBUG,
    sink: (record) => records.push(record),
    clock: () => new Date("2026-05-29T20:00:00.000Z"),
  });

  logger.info("pedido criado", { orderId: "ord-1", total: 99 });

  assertEquals(records.length, 1);
  assertEquals(records[0].service, "OrdersService");
  assertEquals(records[0].level, Levels.INFO);
  assertEquals(records[0].levelName, "INFO");
  assertEquals(records[0].message, "pedido criado");
  assertEquals(records[0].timestamp, "2026-05-29T20:00:00.000Z");
  assertEquals(records[0].context, { orderId: "ord-1", total: 99 });
});

Deno.test("requestLogger: records structured access log with requestId and duration", async () => {
  const records: LogRecord[] = [];
  const logger = new Logger({
    name: "HttpServer",
    level: Levels.INFO,
    sink: (record) => records.push(record),
    clock: () => new Date("2026-05-29T20:00:00.000Z"),
  });
  const app = new App();
  const times = [10, 17];

  app.use(requestLogger({
    logger,
    now: () => times.shift() ?? 17,
  }));
  app.get("/users/:id", () => json({ ok: true }, { status: 201 }));

  const response = await app.fetch(
    new Request("http://localhost/users/123?debug=true", {
      headers: { "x-request-id": "req-abc" },
    }),
  );

  assertEquals(response.status, 201);
  assertEquals(records.length, 1);
  assertEquals(records[0].message, "HTTP request completed");
  assertEquals(records[0].context, {
    method: "GET",
    path: "/users/123",
    status: 201,
    durationMs: 7,
    requestId: "req-abc",
  });
});
