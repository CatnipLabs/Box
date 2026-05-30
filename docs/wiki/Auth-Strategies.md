# Auth Strategies

BOX keeps authentication application-owned. The framework provides the routing
hook, DI registration, and fail-fast startup validation; your strategy decides
whether a request is allowed.

Auth runs after the router matches the endpoint and before Zod request
validation and the controller method.

```text
Request -> Middleware -> Router -> Auth Strategy -> Zod validation -> Controller
```

## Minimal JWT bearer strategy

```ts
import { type AuthStrategyContract, Box, type Context } from "@catniplabs/box";

@Box.Service()
class TokenService {
  public resolveUserId(authorization: string | null): string | undefined {
    const token = authorization?.replace(/^Bearer\s+/i, "");
    return token === "valid-jwt" ? "user_1" : undefined;
  }
}

@Box.AuthStrategy({ name: "jwt", deps: [TokenService] })
class JwtAuthStrategy implements AuthStrategyContract {
  public constructor(private readonly tokens: TokenService) {}

  public validate(ctx: Context): boolean {
    const userId = this.tokens.resolveUserId(
      ctx.request.headers.get("authorization"),
    );

    if (!userId) return false;

    ctx.state.userId = userId;
    return true;
  }
}

@Box.Controller("/admin")
@Box.Auth("jwt")
class AdminController {
  @Box.Get("/")
  public dashboard() {
    return { ok: true };
  }
}

const app = Box.createApp({
  authStrategies: [JwtAuthStrategy],
  controllers: [AdminController],
  services: [TokenService],
});
```

## Protecting controllers and endpoints

Use `@Box.Auth(...)` on a controller to protect every route in that controller:

```ts
@Box.Controller("/billing")
@Box.Auth("jwt")
class BillingController {}
```

Use `@Box.Auth(...)` on one method to protect only that endpoint:

```ts
@Box.Controller("/users")
class UsersController {
  @Box.Post("/")
  @Box.Auth("jwt")
  public create() {
    return { ok: true };
  }
}
```

Route options can also protect endpoints, which is useful for generated or
legacy controller definitions:

```ts
@Box.Post("/", { auth: "jwt" })
public create() {
  return { ok: true };
}
```

## Selecting a strategy

`@Box.Auth()` with no argument is valid only when exactly one strategy is
registered:

```ts
@Box.Get("/me")
@Box.Auth()
public me() {
  return { ok: true };
}
```

When more than one strategy is registered, every protected route must specify
the strategy by name or by class token:

```ts
@Box.Auth("jwt")
@Box.Auth(ApiKeyAuthStrategy)
```

## Strategy return values

A strategy may:

- return `true` or `undefined` to allow the request;
- return `false` to produce `401 Unauthorized` through the normal error
  contract;
- return a `Response` to short-circuit with a custom response;
- throw `Box.HttpError` to use the existing error pipeline.

```ts
@Box.AuthStrategy({ name: "maintenance" })
class MaintenanceStrategy implements AuthStrategyContract {
  public validate(): Response {
    return Box.json({ message: "temporarily unavailable" }, { status: 503 });
  }
}
```

## Dependency injection rules

Auth strategies are first-class injectable resources, but their dependencies are
intentionally constrained:

- auth strategies may inject services;
- auth strategies may inject other auth strategies;
- auth strategies may not inject repositories or controllers directly.

Move persistence access behind a service and inject that service into the
strategy. This keeps auth orchestration independent from storage details and
matches the framework's DDD boundaries.

## Startup validation

`createApp(...)` fails before serving traffic when:

- a protected controller or endpoint has no registered auth strategy;
- more than one strategy is registered and a route uses `@Box.Auth()` without
  specifying which strategy to use;
- a route references an unknown strategy name or token;
- a strategy name is empty or duplicated;
- a class passed to `authStrategies` is not decorated with `@Box.AuthStrategy`;
- the strategy dependency graph violates DI boundaries or has a circular
  dependency.

These checks make protected routes fail closed instead of accidentally becoming
public.
