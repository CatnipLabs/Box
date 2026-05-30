# Arquitetura e DDD

BOX orienta o desenvolvimento para uma arquitetura em camadas, inspirada em DDD
e Clean Architecture, mas mantendo o core leve para serverless.

## Camadas esperadas

```text
presentation/  -> HTTP, controllers, responses, errors e middlewares
application/   -> services e casos de uso
domain/        -> entidades, regras de domínio e contratos base
infra/         -> persistência, runtime, logger e adapters concretos
```

## Fluxo recomendado

```text
Controller -> Service -> Repository -> Entity
```

- Controller lida com HTTP.
- Service concentra regras de aplicação/domínio.
- Repository persiste e consulta entidades.
- Entity representa o domínio.

## Classes base

### Entity

Toda entidade de domínio deve estender `Box.Entity`.

```ts
class User extends Box.Entity<string> {
  constructor(id: string, public readonly name: string) {
    super(id);
  }
}
```

### Repository

Repositórios devem declarar a entidade que manipulam.

```ts
class UsersRepository extends Box.Repository<User> {
  constructor() {
    super(User);
  }
}
```

Isso força o usuário do framework a associar persistência a uma entidade de
domínio real.

### Service

Services estendem `Box.Service` e são o ponto recomendado para regras de
aplicação.

```ts
class UsersService extends Box.Service {
  constructor(private readonly users: UsersRepository) {
    super();
  }
}
```

### Controller

Controllers estendem `Box.Controller`, declaram `path` e retornam rotas
explicitamente.

```ts
class UsersController extends Box.Controller {
  override readonly path = "/users";

  override routes() {
    return [
      this.get(":id", (ctx) => Box.json({ id: ctx.params.id })),
    ];
  }
}
```

## Por que registro explícito?

BOX evita auto-discovery por filesystem, decorators e reflection no caminho
crítico porque esses recursos aumentam custo de inicialização em serverless.

O padrão preferido é:

```ts
const app = new Box.App();
app.controller(new UsersController(new UsersService(new UsersRepository())));
```

Esse estilo deixa as dependências visíveis, facilita testes e reduz cold start.
