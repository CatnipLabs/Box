# Plano de code review e reorganização DDD/Clean Architecture do BOX

## Objetivo

Revisar a codebase inteira do framework BOX com foco em:

- Organização DDD / Clean Architecture.
- SOLID e Clean Code.
- Single Responsibility Principle: evitar arquivos com múltiplas
  classes/interfaces públicas sem uma responsabilidade clara.
- Separar testes das implementações.
- Reduzir pastas “flat” com muitos arquivos soltos, usando subpastas por
  responsabilidade.
- Preservar cold start/serverless e compatibilidade da API pública.
- Manter ou melhorar os gates atuais de teste, coverage, bench e startup.

Este plano é somente planejamento. Nenhuma implementação foi feita neste turno.

## Contexto observado

Branch atual: `main`.

Há mudanças pendentes não commitadas relacionadas às etapas anteriores:

- Core DDD: `src/core/`
- HTTP app/errors/security
- Logger estruturado e request logger
- ORM KV inicial
- README e exports

Gates conhecidos da última rodada:

- `deno task test`: 68 passed / 0 failed
- Coverage global: Branch 91.3%, Function 87.4%, Line 88.8%
- `src/orm/kv_repository.ts`: 100% branch/function/line
- Bench atual aproximado:
  - Create app: ~376 ns
  - Static GET: ~4.7 µs
  - Param GET: ~4.7 µs
- Cold start aproximado:
  - importMs ~1.18 ms
  - createAndRegisterMs ~0.17 ms
  - firstRequestMs ~0.41 ms

## Achados principais do code review

### 1. Testes estão colocalizados com implementação

Hoje existem testes em `src/**`:

- `src/core/core_test.ts`
- `src/http/app_test.ts`
- `src/http/response_test.ts`
- `src/http/security_test.ts`
- `src/logger/index_test.ts`
- `src/mod_test.ts`
- `src/orm/kv_repository_test.ts`

Problema:

- Mistura código de produção e validação.
- Dificulta leitura do pacote publicado.
- Não escala bem para testes unitários, integração, performance e fixtures.

Proposta:

```text
tests/
  unit/
    core/
    http/
    logger/
    orm/
    public-api/
  integration/
    http/
    orm/
  performance/
  fixtures/
```

### 2. Arquivos com múltiplas responsabilidades claras

Arquivos que devem ser divididos primeiro:

#### `src/orm/kv_repository.ts`

Hoje concentra:

- Tipos de key/id/entry.
- Interface `KvStore`.
- Interface `KvEntityMapper`.
- Interface `KvRepositoryOptions`.
- Classe `KvRepository`.
- Classe `KvQueryBuilder`.
- Tipos de query/sort/filter.
- Helpers de comparação/filtro.

Problema: SRP quebrado. É o arquivo mais evidente para refatorar.

#### `src/logger/index.ts`

Hoje concentra:

- Classe `Logger`.
- Interface `RequestLoggerOptions`.
- Middleware `requestLogger`.
- Helpers de request id, duração, erro e serialização.
- Reexports.

Problema: logger core e middleware HTTP são responsabilidades diferentes.

#### `src/http/security.ts`

Hoje concentra:

- CORS.
- Secure headers estilo Helmet.
- Tipos de CORS.
- Tipos de secure headers.
- Helpers de origin/header/vary.

Problema: CORS e secure headers são middlewares independentes.

#### `src/http/app.ts`

Hoje concentra:

- Classe `App`.
- Criação de contexto.
- Detecção de preflight CORS.
- Montagem de resposta universal de erro.
- Join de paths de controller.

Problema: `App` deveria orquestrar, não conter factories/formatadores/guards.

#### `src/http/errors.ts`

Hoje concentra:

- Interface `HttpErrorOptions` não usada diretamente no construtor atual.
- Classe `HttpError`.
- Factories `notFound`, `methodNotAllowed`, `badRequest`, `payloadTooLarge`.
- `defaultCode`.

Problema: mistura exception base, factories e política de code mapping.

#### `src/logger/logger-constructor.schema.ts`

Hoje concentra:

- Tipos de log record/sink/clock/options.
- Parser/schema manual.
- Helpers internos de validação.

Problema: contratos e validação estão juntos.

### 3. Pastas estão simples demais para o tamanho do framework

Exemplo atual:

```text
src/http/
  app.ts
  body.ts
  errors.ts
  index.ts
  middleware.ts
  response.ts
  router.ts
  security.ts
  types.ts
```

O problema não é ter muitos arquivos, mas ter muitos arquivos sem agrupamento
por bounded context/responsabilidade.

Proposta: subpastas pequenas e coesas, com barrel `index.ts` em cada boundary.

### 4. Há nomes e compatibilidade a tratar com cuidado

- `getFormatedName`, `getFormatedLevel`, `getFormatedTime` têm typo em
  “Formated”.
- Como já são métodos públicos, corrigir diretamente seria breaking change.
- Melhor estratégia: adicionar nomes corretos `getFormatted*`, manter aliases
  antigos marcados como deprecated por uma versão.

### 5. ORM atual é bom como primeira fatia, mas não enterprise ainda

Pontos positivos:

- `KvRepository` depende de `KvStore`, não diretamente de `Deno.Kv`.
- Isso preserva DIP e facilita testes.
- Exige `Entity`, alinhado ao DDD pedido.

Pontos a evoluir:

- Query atual faz scan por prefixo da collection e filtra em memória.
- Para enterprise, precisa de índices/materialized access patterns em Deno KV.
- Query builder e repository devem ser separados antes de adicionar índices,
  senão o arquivo ficará ainda mais acoplado.

### 6. Segurança: pontos para revisar após reorganização

- `cors({ origin: "*", credentials: true })` deve ser bloqueado ou normalizado,
  pois browsers não aceitam wildcard com credentials.
- `secureHeaders` ainda não cobre alguns headers comuns, como HSTS,
  Permissions-Policy e X-Permitted-Cross-Domain-Policies.
- CSP padrão está `false`, aceitável para API, mas deve ser documentado como
  escolha consciente.
- Erros inesperados não vazam stack, ponto positivo.

### 7. Coverage ainda não está no padrão final desejado

Arquivos com cobertura baixa ou parcial:

- `core/controller.ts`: linha ~55.9%, função ~50.0%
- `http/app.ts`: linha ~82.7%, função ~63.2%
- `http/body.ts`: linha ~76.9%, branch ~62.5%
- `http/errors.ts`: linha ~55.3%, branch ~50.0%
- `http/router.ts`: linha ~87.1%, branch ~81.8%
- `http/security.ts`: linha ~82.6%, branch ~83.7%

Antes de grandes features novas, recomendo resolver organização + cobertura para
criar uma base limpa.

## Arquitetura-alvo proposta

### Estrutura de alto nível

```text
src/
  core/
    domain/
      entity.ts
      entity-constructor.type.ts
      repository.base.ts
    application/
      service.base.ts
    presentation/
      controller.base.ts
      route-definition.interface.ts
    index.ts

  http/
    application/
      app.ts
      app-context.factory.ts
      controller-path.util.ts
    domain/
      errors/
        http-error.exception.ts
        http-error-code.util.ts
        bad-request.factory.ts
        not-found.factory.ts
        method-not-allowed.factory.ts
        payload-too-large.factory.ts
      response/
        error-response.factory.ts
    presentation/
      body/
        read-json.ts
        read-text.ts
        body-read-options.interface.ts
      response/
        json.response.ts
        text.response.ts
        empty.response.ts
        redirect.response.ts
      router/
        router.ts
        route-match.interface.ts
        router-miss.interface.ts
        path-normalizer.util.ts
        path-compiler.util.ts
      middleware/
        compose.ts
        middleware.type.ts
        context.interface.ts
        handler.type.ts
    security/
      cors/
        cors.middleware.ts
        cors-options.interface.ts
        cors-origin.type.ts
        cors-origin.resolver.ts
        cors-allowed-headers.util.ts
        append-vary.util.ts
        cors-preflight.guard.ts
      secure-headers/
        secure-headers.middleware.ts
        secure-headers-options.interface.ts
        secure-headers-defaults.ts
    index.ts

  logger/
    domain/
      levels.enum.ts
      log-context.type.ts
      log-record.interface.ts
      log-sink.type.ts
      logger-clock.type.ts
    application/
      logger.ts
      logger-options.interface.ts
      logger-options.schema.ts
      message-to-text.util.ts
    presentation/
      colors/
        background-colors.enum.ts
        foreground-colors.enum.ts
      formatters/
        format-log-line.ts
        format-log-level.ts
        format-log-name.ts
        format-log-time.ts
    infrastructure/
      http/
        request-logger.middleware.ts
        request-logger-options.interface.ts
        request-id-context.util.ts
        error-summary.util.ts
    index.ts

  orm/
    kv/
      domain/
        kv-key.type.ts
        kv-entry.interface.ts
        kv-store.interface.ts
        kv-entity-mapper.interface.ts
        kv-repository-options.interface.ts
      application/
        kv-repository.ts
        kv-query-builder.ts
      query/
        query-filter.interface.ts
        query-sort.interface.ts
        query-operator.type.ts
        sort-direction.type.ts
        entity-field.type.ts
        matches-filter.util.ts
        contains-value.util.ts
        compare-values.util.ts
      mapping/
        default-kv-entity-mapper.ts
      index.ts
    index.ts

  adapters/
    deno/
      serve.ts
      index.ts

  mod.ts
```

### Regras arquiteturais

1. `domain/` não importa `Request`, `Response`, `Deno`, `performance`, `console`
   ou APIs de runtime.
2. `application/` orquestra casos de uso e pode depender de contratos de
   domínio.
3. `presentation/` lida com HTTP, formato de resposta, router e middleware.
4. `infrastructure/` contém adaptações externas/runtime-specific.
5. `mod.ts` e `*/index.ts` são barrels públicos, não devem conter regra de
   negócio.
6. Um arquivo deve ter uma classe pública principal no máximo.
7. Interfaces/tipos podem ficar agrupados somente quando forem contratos
   pequenos e inseparáveis; caso contrário, separar em `.interface.ts`,
   `.type.ts` ou `.util.ts`.
8. Refactor não deve alterar comportamento nem API pública sem teste e
   deprecation path.

## Plano de execução recomendado

### Fase 0 — Congelar baseline e proteger comportamento

Objetivo: refatorar sem quebrar.

Passos:

1. Criar branch dedicada, por exemplo:
   - `refactor/ddd-clean-architecture-organization`
2. Registrar baseline atual:
   - `deno task fmt`
   - `deno fmt --check`
   - `deno lint`
   - `deno task check`
   - `deno task test`
   - `deno check src/mod.ts src/core/index.ts src/http/index.ts src/logger/index.ts src/orm/index.ts examples/rest-api/main.ts examples/hello-world/main.ts bench/router_bench.ts scripts/measure_startup.ts`
   - `rm -rf coverage && deno test --coverage=coverage && deno coverage coverage`
   - `deno task bench`
   - `deno run scripts/measure_startup.ts`
3. Não aceitar queda de performance/cold start acima de ruído normal sem
   justificar.
4. Não adicionar features nesta fase; só organização/refactor.

### Fase 1 — Mover testes para fora de `src`

Objetivo: separar produção e testes sem mudar comportamento.

Movimentos sugeridos:

```text
src/core/core_test.ts              -> tests/unit/core/core_test.ts
src/http/app_test.ts               -> tests/unit/http/app_test.ts
src/http/response_test.ts          -> tests/unit/http/response_test.ts
src/http/security_test.ts          -> tests/unit/http/security_test.ts
src/logger/index_test.ts           -> tests/unit/logger/logger_test.ts
src/mod_test.ts                    -> tests/unit/public-api/mod_test.ts
src/orm/kv_repository_test.ts      -> tests/unit/orm/kv/kv_repository_test.ts
```

Ajustes:

- Corrigir imports relativos.
- Criar `tests/fixtures/` para classes fake como `User`, `MemoryKv`, controllers
  de teste etc.
- Atualizar `deno.json` com tasks:
  - `test`: `deno test tests`
  - `test:unit`: `deno test tests/unit`
  - `test:integration`: `deno test tests/integration`
  - `coverage`:
    `rm -rf coverage && deno test --coverage=coverage tests && deno coverage coverage`

Validação:

- Rodar somente testes movidos.
- Depois rodar suite completa.

### Fase 2 — Reorganizar `core`

Objetivo: deixar as bases DDD limpas.

Arquivos prováveis:

```text
src/core/domain/entity.ts
src/core/domain/entity-constructor.type.ts
src/core/domain/repository.base.ts
src/core/application/service.base.ts
src/core/presentation/controller.base.ts
src/core/presentation/route-definition.interface.ts
src/core/index.ts
```

Cuidados:

- Manter exports públicos `Entity`, `Repository`, `Service`, `Controller`,
  `RouteDefinition`.
- Atualizar imports internos sem mudar API pública.
- Testes de controller/repository devem continuar passando.

### Fase 3 — Reorganizar HTTP

Objetivo: separar App, router, middleware, responses, body e errors.

Ordem recomendada:

1. Extrair factories/utils de `src/http/app.ts`:
   - `app-context.factory.ts`
   - `error-response.factory.ts`
   - `controller-path.util.ts`
   - `cors-preflight.guard.ts`
2. Reorganizar errors:
   - `http-error.exception.ts`
   - `http-error-code.util.ts`
   - factories específicas.
3. Reorganizar router:
   - `router.ts`
   - interfaces de match/miss.
   - utils de path/regex.
4. Reorganizar body/response/middleware em subpastas.
5. Atualizar `src/http/index.ts` mantendo exports atuais.

Cuidados:

- Não quebrar contrato universal de erro.
- Não alterar status/body dos testes atuais.
- Preservar preflight CORS antes do router.
- Garantir que `allow` em 405 continue funcionando.

### Fase 4 — Reorganizar segurança

Objetivo: separar CORS e secure headers.

Estrutura:

```text
src/http/security/cors/
src/http/security/secure-headers/
```

Melhorias planejadas, mas como passos separados com TDD:

1. Teste RED para `cors({ origin: "*", credentials: true })`.
2. Decidir comportamento:
   - lançar erro de configuração; ou
   - refletir origin quando credentials=true.
3. Adicionar headers opcionais modernos em `secureHeaders`:
   - `strict-transport-security`
   - `permissions-policy`
   - `x-permitted-cross-domain-policies`
4. Documentar defaults.

### Fase 5 — Reorganizar logger

Objetivo: separar logger core de middleware HTTP e formatação visual.

Estrutura:

```text
src/logger/domain/
src/logger/application/
src/logger/presentation/
src/logger/infrastructure/http/
```

Mudanças recomendadas:

- `Logger` fica em `application/logger.ts`.
- `requestLogger` fica em `infrastructure/http/request-logger.middleware.ts`.
- Tipos `LogRecord`, `LogContext`, `LogSink`, `LoggerClock` ficam em `domain/`.
- Cores e formatters ficam em `presentation/`.
- Corrigir typo com compatibilidade:
  - novo: `getFormattedName`, `getFormattedLevel`, `getFormattedTime`
  - antigo: manter alias `getFormated*` com comentário `@deprecated`.

Validação:

- Testes atuais do logger.
- Teste específico garantindo que aliases antigos ainda funcionam.

### Fase 6 — Reorganizar ORM KV

Objetivo: quebrar `src/orm/kv_repository.ts` em responsabilidades pequenas antes
de adicionar índices.

Estrutura:

```text
src/orm/kv/domain/
src/orm/kv/application/
src/orm/kv/query/
src/orm/kv/mapping/
src/orm/kv/index.ts
src/orm/index.ts
```

Movimentos:

- `KvRepository` isolado.
- `KvQueryBuilder` isolado.
- Interfaces/tipos de KV isolados.
- Operadores e comparadores isolados.
- Mapper default isolado.

Cuidados:

- Manter `Box.KvRepository`.
- Manter `import { KvRepository } from "box/orm"`.
- Não adicionar índices ainda nesta fase; primeiro refatorar com comportamento
  idêntico.

### Fase 7 — Revisão de public API e barrels

Objetivo: garantir que o pacote continue fácil de usar.

Arquivos:

- `src/mod.ts`
- `src/core/index.ts`
- `src/http/index.ts`
- `src/logger/index.ts`
- `src/orm/index.ts`
- `deno.json`

Critérios:

- `Box` continua expondo helpers principais.
- Subpaths continuam funcionando:
  - `box/core`
  - `box/http`
  - `box/logger`
  - `box/orm`
  - `box/adapters/deno`
- Barrels não devem importar dependências caras desnecessárias no hot path.

### Fase 8 — Coverage e quality gates pós-refactor

Depois de toda reorganização:

1. Fechar coverage de arquivos que piorarem por causa da movimentação.
2. Adicionar testes faltantes para:
   - `http/errors`
   - `http/body`
   - `http/router`
   - `http/security`
   - `core/controller`
3. Meta intermediária: 95% global.
4. Meta final do projeto: 100% unit + integration, conforme objetivo enterprise.

Comandos finais:

```bash
deno task fmt
deno fmt --check
deno lint
deno task check
deno task test
deno check src/mod.ts src/core/index.ts src/http/index.ts src/logger/index.ts src/orm/index.ts examples/rest-api/main.ts examples/hello-world/main.ts bench/router_bench.ts scripts/measure_startup.ts
rm -rf coverage && deno test --coverage=coverage && deno coverage coverage
deno task bench
deno run scripts/measure_startup.ts
deno eval --ext=ts --unstable-kv '<smoke com Deno.openKv(":memory:") + KvRepository>'
```

## Riscos e tradeoffs

### Risco 1 — Quebrar imports públicos

Mitigação:

- Refatorar internamente, mas manter barrels e exports públicos.
- Testes de public API em `tests/unit/public-api/`.

### Risco 2 — Overengineering por arquivos pequenos demais

Mitigação:

- Separar classes públicas e responsabilidades reais.
- Não separar helpers triviais se só servem a um arquivo e não têm contrato
  próprio.
- Usar subpastas por contexto para evitar pasta flat gigante.

### Risco 3 — Cold start piorar por barrels pesados

Mitigação:

- Medir startup antes/depois.
- Evitar imports de runtime/adapters no core.
- Evitar decorators/reflection/auto-scan.
- Manter registro explícito.

### Risco 4 — Refactor mascarar bugs existentes

Mitigação:

- Refactor em fatias pequenas.
- Rodar testes por módulo após cada fase.
- Não adicionar feature junto com reorganização.

## Perguntas abertas

1. A regra desejada é “um arquivo por classe/interface/tipo exportado” de forma
   absoluta, ou podemos agrupar tipos pequenos em arquivos `.types.ts` quando
   forem inseparáveis?
2. Você quer manter compatibilidade total com os nomes públicos atuais,
   incluindo typos como `getFormated*`, ou podemos fazer breaking changes agora
   porque o projeto ainda está em fase inicial?
3. Você prefere estrutura DDD mais explícita
   (`domain/application/infrastructure/presentation`) em todos os módulos, ou
   uma versão mais enxuta apenas onde há complexidade real?

## Próximo passo recomendado

Implementar primeiro a Fase 1: mover testes para `tests/` e atualizar
tasks/imports.

Motivo:

- Ataca diretamente uma reclamação sua.
- É uma mudança estrutural de baixo risco.
- Cria base para refatorar os módulos sem misturar produção e teste.
- Facilita separar unit, integration e performance depois.

Depois disso, seguir para `src/orm/kv_repository.ts`, que é hoje o arquivo com a
quebra de SRP mais clara.
