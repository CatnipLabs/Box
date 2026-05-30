# Logs, Erros e Exceptions

## Logger

BOX inclui logger leve e dependency-free, com níveis no estilo NestJS e suporte
a registros estruturados.

```ts
const logger = new Box.Log.Logger({
  name: "UsersService",
  level: Box.Log.Levels.INFO,
});

logger.info("usuário criado", { userId: "usr_123" });
logger.debug("detalhes internos");
```

## Níveis

O nível configurado funciona como threshold.

Se o nível é `INFO`, o logger emite:

- `ERROR`
- `WARN`
- `INFO`

E ignora:

- `DEBUG`
- `TRACE`

## Sink estruturado

```ts
const logger = new Box.Log.Logger({
  name: "api",
  level: Box.Log.Levels.INFO,
  sink: (record) => {
    console.log(JSON.stringify(record));
  },
});
```

## Access logs HTTP

```ts
app.use(Box.requestLogger({ logger }));
```

O middleware registra:

- método HTTP
- path
- status code
- duração
- `requestId` ou `correlationId` quando presentes nos headers
- resumo de erro quando a request falha

## Custom exceptions

```ts
class UserNotFound extends Box.HttpError {
  constructor(id: string) {
    super(404, "User not found", "user_not_found", { id });
  }
}

app.get("/users/:id", () => {
  throw new UserNotFound("42");
});
```

## Helpers de erro

```ts
throw new Box.HttpError(404, "User not found", "user_not_found");
throw Box.badRequest("Invalid payload", { field: "name" });
throw Box.notFound("Route not found");
```

## Contrato universal de erro

Todas as respostas de erro seguem o mesmo formato.

```json
{
  "success": false,
  "error": {
    "statusCode": 404,
    "code": "user_not_found",
    "message": "User not found",
    "details": { "id": "42" },
    "path": "/users/42",
    "method": "GET",
    "requestId": "req-123",
    "timestamp": "2026-05-29T20:00:00.000Z"
  }
}
```

Erros inesperados retornam `500` com resposta segura, sem vazar stack trace.
