# Security

BOX includes modern security middlewares in the HTTP core, without heavy
external dependencies.

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

Use body helpers with explicit limits to reduce the risk of excessive payloads.

```ts
const body = await ctx.json<{ name?: string }>({ maxBytes: 16_384 });
const text = await ctx.text({ maxBytes: 8_192 });
```

## Safe errors

Unexpected errors do not leak stack traces in the HTTP response. The client
receives a universal contract with status, code, message, path, method, request
id, and timestamp.
