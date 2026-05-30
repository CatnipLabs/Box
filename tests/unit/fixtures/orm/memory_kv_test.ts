import { assertEquals, assertRejects } from "@std/assert";
import { MemoryKv } from "../../../fixtures/orm/memory_kv.ts";

Deno.test("MemoryKv fixture: suporta chaves bigint", async () => {
  const kv = new MemoryKv();

  await kv.set(["users", 1n], { id: 1n, name: "Ada" });

  assertEquals(await kv.get(["users", 1n]), {
    value: { id: 1n, name: "Ada" },
  });
});

Deno.test("MemoryKv fixture: list casa prefixo com Uint8Array por valor", async () => {
  const kv = new MemoryKv();
  const tenantA = new Uint8Array([1, 2, 3]);
  const tenantB = new Uint8Array([9, 9, 9]);

  await kv.set(["users", tenantA, "u1"], { id: "u1" });
  await kv.set(["users", tenantB, "u2"], { id: "u2" });

  const values = [];
  for await (
    const entry of kv.list<{ id: string }>({
      prefix: ["users", new Uint8Array([1, 2, 3])],
    })
  ) {
    values.push(entry.value.id);
  }

  assertEquals(values, ["u1"]);
});

Deno.test("MemoryKv fixture: clona valores para evitar mutação por referência", async () => {
  const kv = new MemoryKv();
  const value = { id: "u1", roles: ["admin"] };

  await kv.set(["users", "u1"], value);
  value.roles.push("mutated-after-save");

  const stored = await kv.get<typeof value>(["users", "u1"]);
  stored.value?.roles.push("mutated-after-read");

  assertEquals(await kv.get(["users", "u1"]), {
    value: { id: "u1", roles: ["admin"] },
  });
});

Deno.test("MemoryKv fixture: rejeita valor undefined como Deno KV", async () => {
  const kv = new MemoryKv();

  await assertRejects(
    () => kv.set(["users", "u1"], undefined),
    TypeError,
    "Deno KV does not accept undefined values",
  );
});
