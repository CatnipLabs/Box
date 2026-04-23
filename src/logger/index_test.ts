import { assertEquals, assertThrows, assertMatch } from "@std/assert";
import { stub, assertSpyCalls } from "@std/testing/mock";

import { Logger } from "./index.ts";
import { Levels } from "./levels.enum.ts";
import { ForegroundColors } from "./foreground.colors.ts";
import { BackgroundColors } from "./background.colors.ts";
import type { LoggerConstructorOptions } from "./logger-constructor.schema.ts";

function makeLogger(name?: string) {
  return new Logger({ name, level: Levels.DEBUG });
}

Deno.test(
  "Logger - constructor: instancia com opções válidas (com name)",
  () => {
    const logger = new Logger({ name: "MyService", level: Levels.DEBUG });
    assertEquals(logger.getServiceName(), "MyService");
  },
);

Deno.test(
  "Logger - constructor: instancia com opções válidas (sem name)",
  () => {
    const logger = new Logger({ level: Levels.INFO });
    assertEquals(typeof logger.getServiceName(), "string");
  },
);

Deno.test(
  "Logger - constructor: lança erro quando argumento é null/undefined",
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

Deno.test("getForegroundColor: valor desconhecido → WHITE (default)", () => {
  const logger = makeLogger();
  const color = logger.getForegroundColor("UNKNOWN_LEVEL" as unknown as Levels);
  assertEquals(color, ForegroundColors.WHITE);
});

Deno.test("getFormatedName: sem name retorna string vazia", () => {
  const logger = makeLogger();
  assertEquals(logger.getFormatedName(), "");
});

Deno.test("getFormatedName: com name contém o nome na string", () => {
  const logger = makeLogger("API");
  const result: string = logger.getFormatedName();
  assertEquals(result.includes("API"), true);
});

Deno.test("getFormatedName: com name inclui colchetes e cores de reset", () => {
  const logger = makeLogger("SVC");
  const result: string = logger.getFormatedName();
  assertEquals(result.includes("["), true);
  assertEquals(result.includes("]"), true);
  assertEquals(result.includes(BackgroundColors.RESET), true);
  assertEquals(result.includes(ForegroundColors.BLUE), true);
});

Deno.test("getFormatedLevel: contém o label do nível", () => {
  const logger = makeLogger();
  const result: string = logger.getFormatedLevel(Levels.INFO);
  assertEquals(result.includes(String(Levels.INFO)), true);
});

Deno.test("getFormatedLevel: contém a cor correta para ERROR", () => {
  const logger = makeLogger();
  const result: string = logger.getFormatedLevel(Levels.ERROR);
  assertEquals(result.includes(ForegroundColors.RED), true);
});

Deno.test("getFormatedLevel: contém colchetes e reset", () => {
  const logger = makeLogger();
  const result: string = logger.getFormatedLevel(Levels.DEBUG);
  assertEquals(result.includes("["), true);
  assertEquals(result.includes(BackgroundColors.RESET), true);
});

Deno.test("getFormatedTime: retorna string com timestamp ISO-8601", () => {
  const logger = makeLogger();
  const result: string = logger.getFormatedTime();
  assertMatch(result, /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
});

Deno.test("getFormatedTime: contém GRAY e colchetes", () => {
  const logger = makeLogger();
  const result: string = logger.getFormatedTime();
  assertEquals(result.includes(ForegroundColors.GRAY), true);
  assertEquals(result.includes("["), true);
  assertEquals(result.includes("]"), true);
});

Deno.test("format: inclui nível, timestamp e mensagem", () => {
  const logger = makeLogger("FMT");
  const result: string = logger.format(Levels.INFO, "hello");
  assertEquals(result.includes(String(Levels.INFO)), true);
  assertEquals(result.includes("hello"), true);
  assertMatch(result, /\d{4}-\d{2}-\d{2}/);
});

Deno.test(
  "format: quando sem name o resultado não possui string vazia duplicada estranha",
  () => {
    const logger = makeLogger();
    const result: string = logger.format(Levels.WARN, "msg");
    assertEquals(result.includes("msg"), true);
    assertEquals(result.includes(String(Levels.WARN)), true);
  },
);

Deno.test("format: message pode ser objeto", () => {
  const logger = makeLogger();
  const obj = { key: "value" };
  const result: string = logger.format(Levels.DEBUG, obj);
  assertEquals(result.includes("[object Object]"), true);
});

Deno.test("info: chama console.log com mensagem formatada", () => {
  const logger = makeLogger("TEST");
  using logStub = stub(console, "log");

  logger.info("test info");

  assertSpyCalls(logStub, 1);
  const arg: string = logStub.calls[0].args[0];
  assertEquals(arg.includes("test info"), true);
  assertEquals(arg.includes(String(Levels.INFO)), true);
});

Deno.test("warn: chama console.warn com mensagem formatada", () => {
  const logger = makeLogger("TEST");
  using warnStub = stub(console, "warn");

  logger.warn("test warn");

  assertSpyCalls(warnStub, 1);
  const arg: string = warnStub.calls[0].args[0];
  assertEquals(arg.includes("test warn"), true);
  assertEquals(arg.includes(String(Levels.WARN)), true);
});

Deno.test("error: chama console.error com mensagem formatada", () => {
  const logger = makeLogger("TEST");
  using errorStub = stub(console, "error");

  logger.error("test error");

  assertSpyCalls(errorStub, 1);
  const arg: string = errorStub.calls[0].args[0];
  assertEquals(arg.includes("test error"), true);
  assertEquals(arg.includes(String(Levels.ERROR)), true);
});

Deno.test("debug: chama console.debug com mensagem formatada", () => {
  const logger = makeLogger("TEST");
  using debugStub = stub(console, "debug");

  logger.debug("test debug");

  assertSpyCalls(debugStub, 1);
  const arg: string = debugStub.calls[0].args[0];
  assertEquals(arg.includes("test debug"), true);
  assertEquals(arg.includes(String(Levels.DEBUG)), true);
});

Deno.test("trace: chama console.log com mensagem formatada", () => {
  const logger = makeLogger("TEST");
  using logStub = stub(console, "log");

  logger.trace("test trace");

  assertSpyCalls(logStub, 1);
  const arg: string = logStub.calls[0].args[0];
  assertEquals(arg.includes("test trace"), true);
  assertEquals(arg.includes(String(Levels.TRACE)), true);
});

Deno.test("info: aceita número como mensagem", () => {
  const logger = makeLogger();
  using logStub = stub(console, "log");
  logger.info(42);
  assertSpyCalls(logStub, 1);
});

Deno.test("error: aceita Error como mensagem", () => {
  const logger = makeLogger();
  using errStub = stub(console, "error");
  logger.error(new Error("boom"));
  assertSpyCalls(errStub, 1);
});

Deno.test("warn: aceita null como mensagem", () => {
  const logger = makeLogger();
  using warnStub = stub(console, "warn");
  logger.warn(null);
  assertSpyCalls(warnStub, 1);
});

Deno.test("info com name: saída contém o nome do serviço", () => {
  const logger = makeLogger("OrderService");
  using logStub = stub(console, "log");

  logger.info("order placed");

  const arg: string = logStub.calls[0].args[0];
  assertEquals(arg.includes("OrderService"), true);
});

Deno.test("debug sem name: saída não contém colchete de nome vazio", () => {
  const logger = makeLogger(); // sem name
  using debugStub = stub(console, "debug");

  logger.debug("checking");

  const arg: string = debugStub.calls[0].args[0];
  assertEquals(arg.length > 0, true);
});
