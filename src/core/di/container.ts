import type { ClassProvider } from "./class-provider.interface.ts";
import type { ContainerOptions } from "./container-options.interface.ts";
import type { FactoryProvider } from "./factory-provider.interface.ts";
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

  public resolve<T>(token: InjectionToken<T>): T {
    if (this.singletons.has(token)) {
      return this.singletons.get(token) as T;
    }

    if (!this.providers.has(token)) {
      throw new TypeError(`Provider ${token.name} is not registered`);
    }

    if (this.resolving.has(token)) {
      throw new TypeError(`Circular dependency detected for ${token.name}`);
    }

    this.resolving.add(token);

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
    }
  }

  private dependenciesFor(token: InjectionToken): readonly InjectionToken[] {
    const target = token as InjectableTarget;
    const metadata = getInjectableMetadata(token);
    return metadata?.dependencies.length
      ? metadata.dependencies
      : target.inject ?? target.dependencies ?? [];
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
