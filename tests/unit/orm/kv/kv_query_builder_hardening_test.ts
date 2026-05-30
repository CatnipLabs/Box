import { assertEquals } from "@std/assert";
import { Entity } from "../../../../src/presentation/core/index.ts";
import { KvRepository } from "../../../../src/infra/persistence/kv/index.ts";
import type { KvKey } from "../../../../src/infra/persistence/kv/index.ts";
import { MemoryKv } from "../../../fixtures/orm/memory_kv.ts";

class User extends Entity<string> {
  public constructor(
    id: string,
    public readonly name: string,
    public readonly active: boolean,
  ) {
    super(id);
  }
}

Deno.test("ORM KV hardening: first não muta o limite do query builder", async () => {
  const kv = new MemoryKv();
  const users = new KvRepository(User, kv, { collection: "users" });

  await users.save(new User("u1", "Ada", true));
  await users.save(new User("u2", "Grace", true));

  const query = users.query().where("active", "eq", true);

  assertEquals((await query.first())?.id, "u1");
  assertEquals((await query.all()).map((user) => user.id), ["u1", "u2"]);
});

Deno.test("ORM KV hardening: limit sem ordenação para de iterar após preencher a página", async () => {
  const kv = new MemoryKv();
  const users = new KvRepository(User, kv, { collection: "users" });

  await users.save(new User("u1", "Ada", true));
  await users.save(new User("u2", "Grace", true));
  await users.save(new User("u3", "Linus", true));

  let reads = 0;
  const countingKv = {
    get: kv.get.bind(kv),
    set: kv.set.bind(kv),
    delete: kv.delete.bind(kv),
    async *list<T>(options: { prefix: KvKey }) {
      for await (const entry of kv.list<T>(options)) {
        reads++;
        yield entry;
      }
    },
  };
  const countingUsers = new KvRepository(User, countingKv, {
    collection: "users",
  });

  assertEquals((await countingUsers.query().limit(1).all()).map((u) => u.id), [
    "u1",
  ]);
  assertEquals(reads, 1);
});
