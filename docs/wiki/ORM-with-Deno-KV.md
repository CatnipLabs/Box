# ORM with Deno KV

Box's first ORM adapter is `KvRepository`, a lightweight abstraction over Deno
KV oriented around domain entities.

The goal is to provide CRUD and fluent queries without requiring users to write
manual queries.

## Entity

```ts
class User extends Box.Entity<string> {
  constructor(
    id: string,
    public readonly name: string,
    public readonly age: number,
    public readonly active: boolean,
  ) {
    super(id);
  }
}
```

## Repository

```ts
const kv = await Deno.openKv();
const users = new Box.KvRepository(User, kv, { collection: "users" });
```

## CRUD

```ts
await users.save(new User("u1", "Ada", 37, true));

const user = await users.findById("u1");

await users.deleteById("u1");

const allUsers = await users.all();
```

## Query builder

```ts
const adults = await users
  .query()
  .where("active", "eq", true)
  .where("age", "gte", 18)
  .orderBy("age", "desc")
  .limit(10)
  .offset(0)
  .all();
```

## First result

```ts
const firstAdult = await users
  .query()
  .where("age", "gte", 18)
  .first();
```

## Supported operators

- `eq`
- `ne`
- `gt`
- `gte`
- `lt`
- `lte`
- `contains`

## Sorting and pagination

```ts
const page = await users
  .query()
  .orderBy("name", "asc")
  .offset(20)
  .limit(10)
  .all();
```

## How it currently works

The current implementation scans by collection prefix in Deno KV and applies
filters in memory.

```text
[collection, id] -> entity value
```

This delivers a simple and typed DX now, without coupling the core to decorators
or reflection.

For large volumes, the natural evolution is to add indexes/materialized access
patterns over Deno KV.

## Custom mapper

`KvRepository` accepts a custom mapper when the entity requires special
hydration.

```ts
const users = new Box.KvRepository(User, kv, {
  collection: "users",
  mapper: {
    toValue: (user) => ({ id: user.id, name: user.name }),
    fromValue: (value) =>
      new User(String(value.id), String(value.name), 0, true),
  },
});
```
