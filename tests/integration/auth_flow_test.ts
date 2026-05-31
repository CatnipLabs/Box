import { assertEquals, assertThrows } from "@std/assert";
import {
  Auth,
  AuthStrategy,
  badRequest,
  Controller,
  createApp,
  Get,
  HttpStatus,
  json,
  Post,
  Service,
  z,
} from "../../src/mod.ts";
import type { Body, Context } from "../../src/mod.ts";

const CreatePayload = z.object({ name: z.string().min(1) });
type CreatePayload = z.infer<typeof CreatePayload>;

@Service()
class TokenService {
  public isValid(token: string | undefined): boolean {
    return token === "valid-jwt";
  }
}

@AuthStrategy({ name: "jwt", deps: [TokenService] })
class JwtAuthStrategy {
  public constructor(private readonly tokens: TokenService) {}

  public validate(ctx: Context): boolean | Response {
    if (ctx.request.headers.get("x-auth-block") === "custom") {
      return json({ code: "blocked" }, { status: HttpStatus.FORBIDDEN });
    }

    const token = ctx.request.headers.get("authorization")
      ?.replace(/^Bearer\s+/i, "");

    if (!this.tokens.isValid(token)) return false;

    ctx.state.user = { id: "user_1" };
    return true;
  }
}

@AuthStrategy({ name: "api-key" })
class ApiKeyAuthStrategy {
  public validate(ctx: Context): boolean {
    return ctx.request.headers.get("x-api-key") === "secret";
  }
}

@Controller("/secure")
@Auth()
class SecureController {
  @Get("/")
  public list(): { ok: true } {
    return { ok: true };
  }

  @Post("/", { request: { body: CreatePayload } })
  public create(input: Body<CreatePayload>): { name: string } {
    return { name: input.body.name };
  }
}

@Controller("/mixed")
class MixedAuthController {
  @Get("/jwt")
  @Auth("jwt")
  public jwt(): { ok: true } {
    return { ok: true };
  }

  @Get("/api-key")
  @Auth(ApiKeyAuthStrategy)
  public apiKey(): { ok: true } {
    return { ok: true };
  }

  @Get("/public")
  public publicRoute(): { public: true } {
    return { public: true };
  }
}

@Controller("/legacy-state")
class LegacyStateController extends Controller {
  public override routes() {
    return [
      this.get(
        "/",
        (ctx) => json({ user: ctx.state.user }),
        { auth: "jwt" },
      ),
    ];
  }
}

Deno.test("Auth: protected controller uses the single injected strategy and rejects unauthorized requests", async () => {
  const app = createApp({
    authStrategies: [JwtAuthStrategy],
    controllers: [SecureController],
    services: [TokenService],
  });

  const denied = await app.fetch(new Request("http://localhost/secure"));
  assertEquals(denied.status, HttpStatus.UNAUTHORIZED);

  const allowed = await app.fetch(
    new Request("http://localhost/secure", {
      headers: { authorization: "Bearer valid-jwt" },
    }),
  );
  assertEquals(allowed.status, HttpStatus.OK);
  assertEquals(await allowed.json(), { ok: true });
});

Deno.test("Auth: auth runs before request body validation", async () => {
  const app = createApp({
    authStrategies: [JwtAuthStrategy],
    controllers: [SecureController],
    services: [TokenService],
  });

  const response = await app.fetch(
    new Request("http://localhost/secure", {
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
  );

  assertEquals(response.status, HttpStatus.UNAUTHORIZED);
});

Deno.test("Auth: strategy can short-circuit with a custom response", async () => {
  const app = createApp({
    authStrategies: [JwtAuthStrategy],
    controllers: [SecureController],
    services: [TokenService],
  });

  const response = await app.fetch(
    new Request("http://localhost/secure", {
      headers: { "x-auth-block": "custom" },
    }),
  );

  assertEquals(response.status, HttpStatus.FORBIDDEN);
  assertEquals(await response.json(), { code: "blocked" });
});

Deno.test("Auth: strategies receive the full request context and can write state", async () => {
  const app = createApp({
    authStrategies: [JwtAuthStrategy],
    controllers: [LegacyStateController],
    services: [TokenService],
  });

  const response = await app.fetch(
    new Request("http://localhost/legacy-state", {
      headers: { authorization: "Bearer valid-jwt" },
    }),
  );

  assertEquals(response.status, HttpStatus.OK);
  assertEquals(await response.json(), { user: { id: "user_1" } });
});

Deno.test("Auth: multiple strategies require explicit strategy selection and explicit routes use the selected strategy", async () => {
  const app = createApp({
    authStrategies: [JwtAuthStrategy, ApiKeyAuthStrategy],
    controllers: [MixedAuthController],
    services: [TokenService],
  });

  const publicResponse = await app.fetch(
    new Request("http://localhost/mixed/public"),
  );
  assertEquals(publicResponse.status, HttpStatus.OK);
  assertEquals(await publicResponse.json(), { public: true });

  const jwtResponse = await app.fetch(
    new Request("http://localhost/mixed/jwt", {
      headers: { authorization: "Bearer valid-jwt" },
    }),
  );
  assertEquals(jwtResponse.status, HttpStatus.OK);

  const apiKeyResponse = await app.fetch(
    new Request("http://localhost/mixed/api-key", {
      headers: { "x-api-key": "secret" },
    }),
  );
  assertEquals(apiKeyResponse.status, HttpStatus.OK);
});

Deno.test("Auth: protected endpoint without an injected strategy fails during startup", () => {
  assertThrows(
    () =>
      createApp({ controllers: [SecureController], services: [TokenService] }),
    TypeError,
    "requires at least one auth strategy",
  );
});

Deno.test("Auth: multiple injected strategies with unspecified @Auth fail during startup", () => {
  assertThrows(
    () =>
      createApp({
        authStrategies: [JwtAuthStrategy, ApiKeyAuthStrategy],
        controllers: [SecureController],
        services: [TokenService],
      }),
    TypeError,
    "specify which auth strategy",
  );
});

@Controller("/unknown-strategy")
class UnknownStrategyController {
  @Get("/")
  @Auth("missing")
  public get(): { ok: true } {
    return { ok: true };
  }
}

@Controller("/empty-strategy")
class EmptyStrategyController {
  @Get("/")
  @Auth("")
  public get(): { ok: true } {
    return { ok: true };
  }
}

@Controller("/legacy-empty-strategy")
class LegacyEmptyStrategyController extends Controller {
  public override routes() {
    return [this.get("/", () => ({ ok: true }), { auth: "" })];
  }
}

Deno.test("Auth: unknown strategy names fail during startup", () => {
  assertThrows(
    () =>
      createApp({
        authStrategies: [JwtAuthStrategy],
        controllers: [UnknownStrategyController],
        services: [TokenService],
      }),
    TypeError,
    'Unknown auth strategy "missing"',
  );
});

Deno.test("Auth: empty strategy names fail during startup instead of disabling auth", () => {
  assertThrows(
    () =>
      createApp({
        authStrategies: [JwtAuthStrategy],
        controllers: [EmptyStrategyController],
        services: [TokenService],
      }),
    TypeError,
    "Invalid empty auth strategy name",
  );

  assertThrows(
    () =>
      createApp({
        authStrategies: [JwtAuthStrategy],
        controllers: [LegacyEmptyStrategyController],
        services: [TokenService],
      }),
    TypeError,
    "Invalid empty auth strategy name",
  );
});

@Service()
class ServiceDecoratedAuthStrategy {
  public validate(): boolean {
    return true;
  }
}

Deno.test("Auth: authStrategies entries must be decorated with @AuthStrategy", () => {
  assertThrows(
    () =>
      createApp({
        authStrategies: [ServiceDecoratedAuthStrategy],
        controllers: [MixedAuthController],
      }),
    TypeError,
    "must be decorated with @AuthStrategy",
  );
});

@AuthStrategy({ name: "" })
class EmptyNamedAuthStrategy {
  public validate(): boolean {
    return true;
  }
}

Deno.test("Auth: @AuthStrategy names must be non-empty when provided", () => {
  assertThrows(
    () =>
      createApp({
        authStrategies: [EmptyNamedAuthStrategy],
        controllers: [MixedAuthController],
      }),
    TypeError,
    "empty strategy name",
  );
});

@AuthStrategy({ name: "jwt" })
class DuplicateJwtStrategy {
  public validate(): boolean {
    return true;
  }
}

Deno.test("Auth: duplicate strategy names fail during startup", () => {
  assertThrows(
    () =>
      createApp({
        authStrategies: [JwtAuthStrategy, DuplicateJwtStrategy],
        controllers: [MixedAuthController],
        services: [TokenService],
      }),
    TypeError,
    'Duplicate auth strategy name "jwt"',
  );
});

@AuthStrategy({ name: "dependent", deps: [JwtAuthStrategy] })
class DependentAuthStrategy {
  public constructor(private readonly jwt: JwtAuthStrategy) {}

  public validate(ctx: Context): boolean | Response {
    return this.jwt.validate(ctx);
  }
}

@Controller("/strategy-deps")
class StrategyDepsController {
  @Get("/")
  @Auth("dependent")
  public get(): { ok: true } {
    return { ok: true };
  }
}

Deno.test("Auth: strategies can inject services and other strategies", async () => {
  const app = createApp({
    authStrategies: [JwtAuthStrategy, DependentAuthStrategy],
    controllers: [StrategyDepsController],
    services: [TokenService],
  });

  const response = await app.fetch(
    new Request("http://localhost/strategy-deps", {
      headers: { authorization: "Bearer valid-jwt" },
    }),
  );

  assertEquals(response.status, HttpStatus.OK);
  assertEquals(await response.json(), { ok: true });
});

@AuthStrategy({ name: "throwing" })
class ThrowingAuthStrategy {
  public validate(): never {
    throw badRequest("bad auth input");
  }
}

@Controller("/throwing-auth")
class ThrowingAuthController {
  @Get("/")
  @Auth("throwing")
  public get(): { ok: true } {
    return { ok: true };
  }
}

Deno.test("Auth: strategy HttpError exceptions use the existing error pipeline", async () => {
  const app = createApp({
    authStrategies: [ThrowingAuthStrategy],
    controllers: [ThrowingAuthController],
  });

  const response = await app.fetch(
    new Request("http://localhost/throwing-auth"),
  );

  assertEquals(response.status, HttpStatus.BAD_REQUEST);
});
