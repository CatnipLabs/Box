# ORM com Deno KV

O primeiro adapter ORM do BOX é o `KvRepository`, uma abstração leve sobre Deno
KV orientada a entidades de domínio.

O objetivo é permitir CRUD e consultas fluentes sem que o usuário escreva
queries manualmente.

## Entidade

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

## Repositório

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

## Primeiro resultado

```ts
const firstAdult = await users
  .query()
  .where("age", "gte", 18)
  .first();
```

## Operadores suportados

- `eq`
- `ne`
- `gt`
- `gte`
- `lt`
- `lte`
- `contains`

## Ordenação e paginação

```ts
const page = await users
  .query()
  .orderBy("name", "asc")
  .offset(20)
  .limit(10)
  .all();
```

## Como funciona atualmente

A implementação atual faz scan por prefixo da collection no Deno KV e aplica
filtros em memória.

```text
[collection, id] -> entity value
```

Isso entrega uma DX simples e tipada agora, sem acoplar o core a decorators ou
reflection.

Para volumes grandes, a evolução natural é adicionar índices/materialized access
patterns sobre Deno KV.

## Mapper customizado

`KvRepository` aceita um mapper customizado quando a entidade precisa de
hidratação especial.

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
