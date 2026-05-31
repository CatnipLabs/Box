# Logs, Errors, and Exceptions

## Logger

BOX includes a lightweight, dependency-free logger with NestJS-style levels and
structured record support.

```ts
const logger = new Box.Log.Logger({
  name: "UsersService",
  level: Box.Log.Levels.INFO,
});

logger.info("user created", { userId: "usr_123" });
logger.debug("internal details");
```

## Levels

The configured level works as a threshold.

If the level is `INFO`, the logger emits:

- `ERROR`
- `WARN`
- `INFO`

And ignores:

- `DEBUG`
- `TRACE`

## Structured sink

```ts
const logger = new Box.Log.Logger({
  name: "api",
  level: Box.Log.Levels.INFO,
  sink: (record) => {
    console.log(JSON.stringify(record));
  },
});
```

## HTTP access logs

```ts
app.use(Box.requestLogger({ logger }));
```

The middleware records:

- HTTP method
- path
- status code
- duration
- `requestId` or `correlationId` when present in the headers
- error summary when the request fails

## Custom exceptions

```ts
class UserNotFound extends Box.HttpError {
  public constructor(id: string) {
    super(404, "User not found", "user_not_found", { id });
  }
}

@Box.Controller("/users")
class UsersController {
  @Box.Get(":id")
  public findById(): never {
    throw new UserNotFound("42");
  }
}
```

## Error helpers

```ts
throw new Box.HttpError(404, "User not found", "user_not_found");
throw Box.badRequest("Invalid payload", { field: "name" });
throw Box.notFound("Route not found");
```

## Universal error contract

All error responses follow the same format.

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

Unexpected errors return `500` with a safe response, without leaking stack
traces.
