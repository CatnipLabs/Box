import { assertEquals, assertInstanceOf } from "@std/assert";
import { Entity } from "../../../../src/presentation/core/index.ts";
import { KvRepository } from "../../../../src/infra/persistence/kv/index.ts";
import { KvRepository as LegacyKvRepository } from "../../../../src/infra/persistence/kv/index.ts";
import { MemoryKv } from "../../../fixtures/orm/memory_kv.ts";

class User extends Entity<string> {
  public constructor(
    id: string,
    public readonly name: string,
    public readonly age: number,
    public readonly active: boolean,
    public readonly tags: string[] = [],
    public readonly score?: number,
  ) {
    super(id);
  }

  public displayName(): string {
    return `${this.name}#${this.id}`;
  }
}

Deno.test("ORM KV: barrel legado exporta o mesmo KvRepository público", () => {
  assertEquals(LegacyKvRepository, KvRepository);
});

Deno.test("ORM KV: mapper customizado controla persistência e hidratação", async () => {
  const kv = new MemoryKv();
  const users = new KvRepository(User, kv, {
    collection: "users",
    mapper: {
      toValue(user) {
        return {
          id: user.id,
          display_name: user.name,
          years_old: user.age,
          enabled: user.active,
        };
      },
      fromValue(value) {
        return new User(
          String(value.id),
          String(value.display_name),
          Number(value.years_old),
          Boolean(value.enabled),
        );
      },
    },
  });

  await users.save(new User("u1", "Ada", 37, true));

  assertEquals(await kv.get(["users", "u1"]), {
    value: {
      id: "u1",
      display_name: "Ada",
      years_old: 37,
      enabled: true,
    },
  });
  assertEquals((await users.findById("u1"))?.displayName(), "Ada#u1");
});

Deno.test("ORM KV: repository exige Entity e persiste por collection/id", async () => {
  const kv = new MemoryKv();
  const users = new KvRepository(User, kv, { collection: "users" });

  await users.save(new User("u1", "Ada", 37, true));

  const user = await users.findById("u1");

  assertInstanceOf(user, User);
  assertEquals(user?.id, "u1");
  assertEquals(user?.name, "Ada");
  assertEquals(user?.displayName(), "Ada#u1");
  assertEquals(await kv.get(["users", "u1"]), {
    value: {
      id: "u1",
      name: "Ada",
      age: 37,
      active: true,
      tags: [],
      score: undefined,
    },
  });
});

Deno.test("ORM KV: deleteById remove entidade pelo id", async () => {
  const kv = new MemoryKv();
  const users = new KvRepository(User, kv, { collection: "users" });

  await users.save(new User("u1", "Ada", 37, true));
  await users.deleteById("u1");

  assertEquals(await users.findById("u1"), undefined);
});

Deno.test("ORM KV: query fluente filtra, ordena, pagina e hidrata entidades", async () => {
  const kv = new MemoryKv();
  const users = new KvRepository(User, kv, { collection: "users" });

  await users.save(new User("u1", "Ada", 37, true));
  await users.save(new User("u2", "Grace", 17, true));
  await users.save(new User("u3", "Linus", 54, false));
  await users.save(new User("u4", "Margaret", 87, true));

  const result: User[] = await users
    .query()
    .where("active", "eq", true)
    .where("age", "gte", 18)
    .orderBy("age", "desc")
    .offset(0)
    .limit(2)
    .all();

  assertEquals(result.map((user) => user.displayName()), [
    "Margaret#u4",
    "Ada#u1",
  ]);
});

Deno.test("ORM KV: first retorna primeira entidade encontrada ou undefined", async () => {
  const kv = new MemoryKv();
  const users = new KvRepository(User, kv, { collection: "users" });

  await users.save(new User("u1", "Ada", 37, true));

  assertEquals(
    (await users.query().where("name", "contains", "da").first())?.id,
    "u1",
  );
  assertEquals(
    await users.query().where("name", "eq", "Grace").first(),
    undefined,
  );
});

Deno.test("ORM KV: all usa a collection padrão da entidade", async () => {
  const kv = new MemoryKv();
  const users = new KvRepository(User, kv);

  await users.save(new User("u1", "Ada", 37, true));

  assertEquals(users.collection, "User");
  assertEquals((await users.all()).map((user) => user.id), ["u1"]);
  assertEquals((await kv.get(["User", "u1"])).value !== null, true);
});

Deno.test("ORM KV: operadores de query cobrem comparações e contains em arrays", async () => {
  const kv = new MemoryKv();
  const users = new KvRepository(User, kv, { collection: "users" });

  await users.save(new User("u1", "Ada", 37, true, ["admin", "staff"], 10));
  await users.save(new User("u2", "Grace", 17, true, ["staff"], 20));
  await users.save(new User("u3", "Linus", 54, false, ["guest"], 30));

  assertEquals(
    (await users.query().where("name", "ne", "Ada").all()).map((user) =>
      user.id
    ),
    ["u2", "u3"],
  );
  assertEquals(
    (await users.query().where("age", "gt", 37).all()).map((user) => user.id),
    ["u3"],
  );
  assertEquals(
    (await users.query().where("age", "lt", 37).all()).map((user) => user.id),
    ["u2"],
  );
  assertEquals(
    (await users.query().where("age", "lte", 37).all()).map((user) => user.id),
    ["u1", "u2"],
  );
  assertEquals(
    (await users.query().where("tags", "contains", "admin").all()).map((user) =>
      user.id
    ),
    ["u1"],
  );
  assertEquals(
    await users.query().where("active", "contains", true).all(),
    [],
  );
});

Deno.test("ORM KV: orderBy trata valores iguais e ausentes de forma determinística", async () => {
  const kv = new MemoryKv();
  const users = new KvRepository(User, kv, { collection: "users" });

  await users.save(new User("u3", "Linus", 54, true));
  await users.save(new User("u1", "Ada", 37, true, [], 10));
  await users.save(new User("u2", "Grace", 17, true, [], 10));

  assertEquals(
    (await users.query().orderBy("score", "asc").all()).map((user) => user.id),
    ["u3", "u1", "u2"],
  );
  assertEquals(
    (await users.query().orderBy("score", "desc").all()).map((user) => user.id),
    ["u1", "u2", "u3"],
  );

  const anotherKv = new MemoryKv();
  const anotherUsers = new KvRepository(User, anotherKv, {
    collection: "users",
  });
  await anotherUsers.save(new User("u0", "Linus", 54, true));
  await anotherUsers.save(new User("u1", "Ada", 37, true, [], 10));

  assertEquals(
    (await anotherUsers.query().orderBy("score", "asc").all()).map((user) =>
      user.id
    ),
    ["u0", "u1"],
  );
});
