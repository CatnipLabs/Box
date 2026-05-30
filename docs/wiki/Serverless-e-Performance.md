# Serverless e Performance

BOX foi desenhado para serverless e edge runtimes.

## Princípios

- Core baseado em Fetch API.
- Sem decorators obrigatórios.
- Sem reflection no caminho quente.
- Sem auto-discovery por filesystem.
- Registro explícito de rotas/controllers.
- Dependências leves no core HTTP.
- Middlewares compostos de forma previsível.

## Deploy Fetch-first

```ts
export default {
  fetch: (request: Request) => app.fetch(request),
};
```

Esse formato se encaixa em runtimes como Deno Deploy, Cloudflare Workers e
ambientes serverless compatíveis com Fetch API.

## Deno local/server

```ts
import { serve } from "box/adapters/deno";
import app from "./app.ts";

serve(app);
```

## Medindo cold start

O repositório inclui script de medição:

```bash
deno run scripts/measure_startup.ts
```

A medição acompanha:

- tempo de import do entrypoint público
- tempo para criar o app e registrar rotas
- tempo da primeira request

## Benchmarks

```bash
deno task bench
```

Benchmarks atuais cobrem criação de app e dispatch de rotas
estáticas/parametrizadas.

## Testes de performance

```bash
deno task test:performance
```

Os testes de performance verificam thresholds de:

- cold import
- setup inicial
- first request
- latência média do router
- p95 sob carga in-process

## Diretriz para novas features

Antes de adicionar automação mágica ao framework, avalie impacto no cold start.

Preferência do BOX:

```text
explícito > mágico
simples > genérico demais
baixo cold start > ergonomia baseada em reflection
```
