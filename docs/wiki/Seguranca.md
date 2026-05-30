# Segurança

BOX inclui middlewares de segurança modernos no core HTTP, sem dependências
externas pesadas.

## Secure headers

```ts
app.use(Box.secureHeaders());
```

Headers padrão:

| Header                         | Valor padrão  |
| ------------------------------ | ------------- |
| `x-content-type-options`       | `nosniff`     |
| `x-frame-options`              | `DENY`        |
| `referrer-policy`              | `no-referrer` |
| `x-dns-prefetch-control`       | `off`         |
| `cross-origin-opener-policy`   | `same-origin` |
| `cross-origin-resource-policy` | `same-origin` |

O middleware não sobrescreve headers já definidos pelo handler e permite
alterar/desabilitar headers via opções.

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

Por padrão, `origin` é `"*"`.

Para APIs com cookies ou credenciais, use allowlist explícita.

## Preflight

O CORS nativo responde requests `OPTIONS` de preflight sem exigir rotas manuais.

## Body limits

Use os helpers de body com limite explícito para reduzir risco de payload
excessivo.

```ts
const body = await ctx.json<{ name?: string }>({ maxBytes: 16_384 });
const text = await ctx.text({ maxBytes: 8_192 });
```

## Erros seguros

Erros inesperados não vazam stack trace na resposta HTTP. O cliente recebe um
contrato universal com status, código, mensagem, path, método, request id e
timestamp.
