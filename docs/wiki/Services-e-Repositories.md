# Services e Repositories

## Service

Services representam regras de aplicação e orquestram repositórios.

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

## Repository base

Um repository deve receber uma classe de entidade.

```ts
class UsersRepository extends Box.Repository<User> {
  constructor() {
    super(User);
  }
}
```

## Repository com Deno KV

Para persistência real, use `Box.KvRepository`.

```ts
class UsersRepository extends Box.KvRepository<User> {
  constructor(kv: Deno.Kv) {
    super(User, kv, { collection: "users" });
  }
}
```

Métodos principais:

```ts
await users.save(user);
await users.findById("u1");
await users.deleteById("u1");
await users.all();
users.query();
```

## Custom repositories

Você pode estender `KvRepository` para criar métodos de domínio.

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

## Testabilidade

Como as dependências são explícitas, testes podem instanciar
services/controllers diretamente com doubles ou stores em memória.
