# Testes e Contribuição

## Qualidade esperada

BOX deve evoluir como projeto open source com qualidade enterprise:

- código formatado
- lint limpo
- type check limpo
- testes unitários
- testes de integração
- testes de performance
- benchmarks
- medição de cold start
- documentação atualizada

## Comandos obrigatórios antes de abrir PR

```bash
deno task fmt
deno task lint
deno task check
deno task test
deno task test:unit
deno task test:integration
deno task test:performance
deno task coverage
deno task bench
deno run scripts/measure_startup.ts
```

## Organização de testes

```text
tests/unit/          -> testes unitários
tests/integration/   -> fluxos reais com App, Controller, Service, Repository, middlewares e errors
tests/performance/   -> thresholds de performance/cold start
bench/               -> benchmarks Deno
```

## O que testar em novas features

Toda feature nova deve incluir, quando aplicável:

- testes de happy path
- testes de erro
- contrato de resposta HTTP
- integração com controller/service/repository
- impacto em segurança/logs
- impacto em performance/cold start

## Convenções arquiteturais

O projeto segue uma separação DDD/Clean Architecture:

```text
src/domain
src/application
src/infra
src/presentation
```

Evite dependências invertidas entre camadas.

## Commits

Use mensagens claras e pequenas. Exemplos:

```text
feat: add scalar documentation route
fix: preserve request id in error responses
test: add integration coverage for kv repository
perf: reduce router dispatch allocations
docs: publish framework wiki
```

## Roadmap recomendado

- Rota de documentação OpenAPI/Scalar auto-gerada a partir de contratos de
  código.
- Índices/materialized access patterns para queries grandes no Deno KV.
- Mais adapters serverless.
- Templates de projeto.
- Guia de publicação do pacote.
- CI com coverage gates.
