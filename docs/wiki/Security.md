# Security

BOX includes modern security middlewares in the HTTP core, without heavy
external dependencies.

## Auth strategies

Box protects controllers and endpoints with user-owned auth strategies. The
framework does not force JWT into the router hot path; instead, a strategy gets
the full request `Context` and can validate a bearer token, cookie, API key, or
any other application-specific credential.

```ts
@Box.Service()
class TokenService {
  isValid(token: string | undefined): boolean {
    return token === "valid-jwt";
  }
}

@Box.AuthStrategy({ name: "jwt", deps: [TokenService] })
class JwtAuthStrategy implements Box.AuthStrategyContract {
  constructor(private readonly tokens: TokenService) {}

  validate(ctx: Box.Context): boolean {
    const token = ctx.request.headers.get("authorization")
      ?.replace(/^Bearer\s+/i, "");

    if (!this.tokens.isValid(token)) return false;

    ctx.state.user = { id: "user_1" };
    return true;
  }
}

@Box.Controller("/admin")
@Box.Auth("jwt")
class AdminController {
  @Box.Get("/")
  list() {
    return { ok: true };
  }
}

const app = Box.createApp({
  authStrategies: [JwtAuthStrategy],
  controllers: [AdminController],
  services: [TokenService],
});
```

A strategy may return `true`/`undefined` to allow the request, `false` to return
`401 Unauthorized`, a `Response` to short-circuit, or throw `Box.HttpError` to
use the normal error pipeline. Auth runs before route request validation.

Startup fails fast when a protected route has no registered strategy, when
multiple strategies are registered and `@Box.Auth()` does not specify which one
to use, or when the strategy dependency graph violates Box's DI boundaries.

## Secure headers

```ts
app.use(Box.secureHeaders());
```

Default headers:

| Header                         | Default value |
| ------------------------------ | ------------- |
| `x-content-type-options`       | `nosniff`     |
| `x-frame-options`              | `DENY`        |
| `referrer-policy`              | `no-referrer` |
| `x-dns-prefetch-control`       | `off`         |
| `cross-origin-opener-policy`   | `same-origin` |
| `cross-origin-resource-policy` | `same-origin` |

The middleware does not overwrite headers already defined by the handler and
allows headers to be changed or disabled through options.

## CORS

```ts
app.use(Box.cors({
  origin: ["https://app.example.com"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["authorization", "content-type"],
  credentials: true,
  maxAge: 600,
}));
```

By default, `origin` is `"*"`.

For APIs with cookies or credentials, use an explicit allowlist.

## Preflight

Built-in CORS answers preflight `OPTIONS` requests without requiring manual
routes.

## Body limits

Use route-level body helpers for endpoint-specific limits, or use global
`payloadLimit` middleware to reject excessive request bodies before handlers
run.

```ts
app.use(Box.payloadLimit({
  jsonMaxBytes: Box.RequestSizeLimit.MB1,
  uploadMaxBytes: Box.RequestSizeLimit.MB10,
  defaultMaxBytes: Box.RequestSizeLimit.MB1,
}));

const body = await ctx.json<{ name?: string }>({
  maxBytes: Box.RequestSizeLimit.KB16,
});
const text = await ctx.text({ maxBytes: Box.RequestSizeLimit.KB8 });
```

`payloadLimit` treats `application/json` and `application/*+json` as JSON,
`multipart/form-data` and `application/octet-stream` as uploads, and all other
content types with `defaultMaxBytes`. Oversized payloads return `413` with the
universal `payload_too_large` error contract.

## Rate limit

```ts
const kv = await Deno.openKv();

app.use(Box.rateLimit({
  kv,
  limit: 100,
  windowMs: 60_000,
  namespace: "public-api",
}));
```

The rate limiter stores counters in Deno KV with atomic compare-and-set,
allowing all instances of the same application to share limits when they use the
same KV store. Responses include `x-ratelimit-limit`, `x-ratelimit-remaining`,
`x-ratelimit-reset`, and blocked requests return `429` plus `retry-after`.

By default, the client identifier is resolved from `cf-connecting-ip`,
`x-real-ip`, then the first `x-forwarded-for` value. In production, only trust
these headers when they are set by your proxy/CDN boundary; otherwise pass a
custom `identifier` callback.

## Request time

```ts
app.use(Box.requestTime());
```

Adds an `x-response-time-ms` header with the time spent processing the request.
Use `requestTime({ headerName: "server-timing-ms" })` to customize the header.

## Safe errors

Unexpected errors do not leak stack traces in the HTTP response. The client
receives a universal contract with status, code, message, path, method, request
id, and timestamp.
