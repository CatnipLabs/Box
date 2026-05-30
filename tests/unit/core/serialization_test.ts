import { assertEquals } from "@std/assert";
import { safeJsonValue, safeStringify } from "../../../src/core/index.ts";

Deno.test("Serialization: safeJsonValue serializa tipos não JSON e ciclos", () => {
  const object: Record<string, unknown> = {
    value: 1n,
    fn: () => "ok",
    symbol: Symbol("box"),
    date: new Date("2026-05-30T00:00:00.000Z"),
    error: new TypeError("invalid"),
    nested: [] as unknown[],
  };
  (object.nested as unknown[]).push(object);

  assertEquals(safeJsonValue(object), {
    value: "1",
    fn: '()=>"ok"',
    symbol: "Symbol(box)",
    date: "2026-05-30T00:00:00.000Z",
    error: { name: "TypeError", message: "invalid" },
    nested: ["[Circular]"],
  });
});

Deno.test("Serialization: safeStringify retorna fallback para toJSON quebrado", () => {
  const value = {
    toJSON() {
      throw new Error("boom");
    },
  };

  assertEquals(safeStringify(value), '"[Unserializable]"');
});
