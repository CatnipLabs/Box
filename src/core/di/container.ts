import type { ClassProvider } from "./class-provider.interface.ts";
import type { ContainerOptions } from "./container-options.interface.ts";
import type { FactoryProvider } from "./factory-provider.interface.ts";
import type { InjectableKind } from "./injectable-kind.type.ts";
import type { InjectableTarget } from "./injectable-target.type.ts";
import type { InjectionToken } from "./injection-token.type.ts";
import { getInjectableMetadata } from "./injectable-metadata-store.ts";
import type { Provider } from "./provider.type.ts";
import type { ValueProvider } from "./value-provider.interface.ts";

export class Container {
  private readonly providerDefinitions = new Map<
    InjectionToken,
    ClassProvider | FactoryProvider | ValueProvider
  >();
  private readonly providers = new Set<InjectionToken>();
  private readonly resolving = new Set<InjectionToken>();
  private readonly resolvingStack: InjectionToken[] = [];
  private readonly singletons = new Map<InjectionToken, unknown>();

  public constructor(private readonly options: ContainerOptions = {}) {}

  public register<T>(token: InjectionToken<T>): this {
    if (
      this.options.requireInjectableMetadata &&
      !getInjectableMetadata(token)
    ) {
      throw new TypeError(
        `Provider ${token.name} must be decorated before registration`,
      );
    }

    this.providers.add(token);
    return this;
  }

  public registerProvider<T>(provider: Provider<T>): this {
    if (isInjectionToken(provider)) {
      return this.register(provider);
    }

    this.providers.add(provider.provide);
    this.providerDefinitions.set(provider.provide, provider);
    return this;
  }

  public validateGraph(): void {
    this.validateDependencyBoundaries();
    this.validateNoCircularDependencies();
  }

  public resolve<T>(token: InjectionToken<T>): T {
    if (this.singletons.has(token)) {
      return this.singletons.get(token) as T;
    }

    if (!this.providers.has(token)) {
      throw new TypeError(`Provider ${token.name} is not registered`);
    }

    if (this.resolving.has(token)) {
      const index = this.resolvingStack.indexOf(token);
      const cycle = index >= 0
        ? [...this.resolvingStack.slice(index), token]
        : [token, token];
      throw new TypeError(circularDependencyMessage(cycle));
    }

    this.resolving.add(token);
    this.resolvingStack.push(token);

    try {
      const provider = this.providerDefinitions.get(token) as
        | ClassProvider<T>
        | FactoryProvider<T>
        | ValueProvider<T>
        | undefined;
      const instance = provider
        ? this.instantiateProvider(provider)
        : this.instantiateClass(token);

      this.singletons.set(token, instance);
      return instance;
    } finally {
      this.resolving.delete(token);
      this.resolvingStack.pop();
    }
  }

  private validateDependencyBoundaries(): void {
    for (const token of this.providers) {
      const kind = injectableKind(token);
      if (!kind) continue;

      for (const dependency of this.dependenciesForRegisteredToken(token)) {
        if (!this.providers.has(dependency)) continue;

        const dependencyKind = injectableKind(dependency);
        if (isAllowedDependency(kind, dependencyKind)) continue;

        throw new TypeError(
          `Invalid dependency: ${token.name} (${
            kindLabel(kind)
          }) depends on ${dependency.name} (${kindLabel(dependencyKind)}). ${
            dependencyRuleMessage(kind)
          }`,
        );
      }
    }
  }

  private validateNoCircularDependencies(): void {
    const visited = new Set<InjectionToken>();
    const visiting = new Set<InjectionToken>();
    const stack: InjectionToken[] = [];

    const visit = (token: InjectionToken): void => {
      if (visited.has(token)) return;

      if (visiting.has(token)) {
        const index = stack.indexOf(token);
        const cycle = index >= 0
          ? [...stack.slice(index), token]
          : [token, token];
        throw new TypeError(circularDependencyMessage(cycle));
      }

      visiting.add(token);
      stack.push(token);

      for (const dependency of this.dependenciesForRegisteredToken(token)) {
        if (this.providers.has(dependency)) visit(dependency);
      }

      stack.pop();
      visiting.delete(token);
      visited.add(token);
    };

    for (const token of this.providers) visit(token);
  }

  private dependenciesFor(token: InjectionToken): readonly InjectionToken[] {
    const target = token as InjectableTarget;
    const metadata = getInjectableMetadata(token);
    return metadata?.dependencies.length
      ? metadata.dependencies
      : target.inject ?? target.dependencies ?? [];
  }

  private dependenciesForRegisteredToken(
    token: InjectionToken,
  ): readonly InjectionToken[] {
    const provider = this.providerDefinitions.get(token);

    if (!provider) return this.dependenciesFor(token);

    if ("useValue" in provider) return [];

    if ("useClass" in provider) return this.dependenciesFor(provider.useClass);

    return provider.deps ?? [];
  }

  private instantiateClass<T>(token: InjectionToken<T>): T {
    const dependencies = this.dependenciesFor(token);
    const args = dependencies.map((dependency) => this.resolve(dependency));
    const constructor = token as unknown as new (...args: never[]) => T;
    return new constructor(...(args as never[]));
  }

  private instantiateProvider<T>(
    provider: ClassProvider<T> | FactoryProvider<T> | ValueProvider<T>,
  ): T {
    if ("useValue" in provider) {
      return provider.useValue;
    }

    if ("useClass" in provider) {
      return this.instantiateClass(provider.useClass);
    }

    const args = (provider.deps ?? []).map((dependency) =>
      this.resolve(dependency)
    );
    return provider.useFactory(...(args as never[]));
  }
}

function isInjectionToken<T>(
  provider: Provider<T>,
): provider is InjectionToken<T> {
  return typeof provider === "function";
}

function injectableKind(token: InjectionToken): InjectableKind | undefined {
  return getInjectableMetadata(token)?.kind;
}

function isAllowedDependency(
  kind: InjectableKind,
  dependencyKind: InjectableKind | undefined,
): boolean {
  switch (kind) {
    case "controller":
      return dependencyKind === "service";
    case "service":
      return dependencyKind === "service" || dependencyKind === "repository" ||
        dependencyKind === "producer";
    case "producer":
      return dependencyKind === "service";
    case "consumer":
      return dependencyKind === "service";
    case "auth-strategy":
      return dependencyKind === "service" || dependencyKind === "auth-strategy";
    case "repository":
      return dependencyKind === undefined || dependencyKind === "repository";
  }
}

function dependencyRuleMessage(kind: InjectableKind): string {
  switch (kind) {
    case "controller":
      return "Controllers may inject services only.";
    case "service":
      return "Services may inject services, repositories, or producers only.";
    case "producer":
      return "Producers may inject services only.";
    case "consumer":
      return "Consumers may inject services only.";
    case "auth-strategy":
      return "Auth strategies may inject services or auth strategies only.";
    case "repository":
      return "Repositories may inject repositories or explicit provider tokens only.";
  }
}

function kindLabel(kind: InjectableKind | undefined): string {
  return kind ?? "provider";
}

function circularDependencyMessage(cycle: readonly InjectionToken[]): string {
  return `Circular dependency detected: ${
    cycle.map((token) => token.name).join(" -> ")
  }.\n` +
    "Circular dependencies usually indicate an architecture decision problem: responsibilities from different contexts are probably being mixed in the same service. Split orchestration into a separate service or move the behavior to the proper bounded context.";
}
