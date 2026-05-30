# Services and Repositories

## Service

Services represent application rules and orchestrate repositories.

```ts
class UsersService extends Box.Service {
  constructor(private readonly users: UsersRepository) {
    super();
  }

  async create(input: { name?: string }): Promise<User> {
    if (!input.name) {
      throw Box.badRequest("User name is required", { field: "name" });
    }

    const user = new User(crypto.randomUUID(), input.name, true);
    return await this.users.save(user);
  }
}
```

## Base Repository

A repository must receive an entity class.

```ts
class UsersRepository extends Box.Repository<User> {
  constructor() {
    super(User);
  }
}
```

## Repository with Deno KV

For real persistence, use `Box.KvRepository`.

```ts
class UsersRepository extends Box.KvRepository<User> {
  constructor(kv: Deno.Kv) {
    super(User, kv, { collection: "users" });
  }
}
```

Main methods:

```ts
await users.save(user);
await users.findById("u1");
await users.deleteById("u1");
await users.all();
users.query();
```

## Custom repositories

You can extend `KvRepository` to create domain methods.

```ts
class UsersRepository extends Box.KvRepository<User> {
  constructor(kv: Deno.Kv) {
    super(User, kv, { collection: "users" });
  }

  async findActiveAdults() {
    return await this.query()
      .where("active", "eq", true)
      .where("age", "gte", 18)
      .orderBy("age", "desc")
      .all();
  }
}
```

## Testability

Because dependencies are explicit, tests can instantiate services/controllers
directly with doubles or in-memory stores.
