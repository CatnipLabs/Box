import { getInjectableMetadata } from "../../../core/di/index.ts";
import type { Container, InjectionToken } from "../../../core/di/index.ts";
import type { AuthRequirement } from "./auth-requirement.type.ts";

import type { AuthStrategyContract } from "./auth-strategy-contract.interface.ts";
import { getAuthStrategyMetadata } from "./auth-strategy-metadata-store.ts";
import type { AuthRouteDescriptor } from "./auth-route-descriptor.interface.ts";

export class AuthStrategyRegistry {
  private readonly names = new Map<
    string,
    InjectionToken<AuthStrategyContract>
  >();

  public constructor(
    private readonly strategies: readonly InjectionToken<
      AuthStrategyContract
    >[],
    private readonly container: Container,
  ) {
    for (const strategy of strategies) {
      assertAuthStrategyToken(strategy);
      const name = strategyName(strategy);
      const existing = this.names.get(name);

      if (existing) {
        throw new TypeError(`Duplicate auth strategy name "${name}"`);
      }

      this.names.set(name, strategy);
    }
  }

  public resolve(
    requirement: AuthRequirement,
    route: AuthRouteDescriptor,
  ): AuthStrategyContract {
    const token = this.resolveToken(requirement, route);
    return this.container.resolve(token) as AuthStrategyContract;
  }

  private resolveToken(
    requirement: AuthRequirement,
    route: AuthRouteDescriptor,
  ): InjectionToken<AuthStrategyContract> {
    if (this.strategies.length === 0) {
      throw new TypeError(
        `${describeRoute(route)} requires at least one auth strategy. ` +
          "Register an @AuthStrategy class in createApp({ authStrategies: [...] }) before protecting controllers or endpoints.",
      );
    }

    if (requirement === true) {
      if (this.strategies.length === 1) return this.strategies[0];

      throw new TypeError(
        `${
          describeRoute(route)
        } is protected with @Auth() but multiple auth strategies are registered. ` +
          "Please specify which auth strategy to use for this controller or endpoint.",
      );
    }

    if (typeof requirement === "string") {
      const requestedName = requirement.trim();
      if (!requestedName) {
        throw new TypeError(
          `Invalid empty auth strategy name for ${describeRoute(route)}. ` +
            "Pass a non-empty strategy name or omit the argument only when exactly one strategy is registered.",
        );
      }

      const token = this.names.get(requestedName);
      if (token) return token;

      throw new TypeError(
        `Unknown auth strategy "${requestedName}" for ${
          describeRoute(route)
        }. ` +
          `Available strategies: ${this.availableStrategies()}.`,
      );
    }

    const token = requirement;
    if (!token || typeof token.name !== "string") {
      throw new TypeError(
        `Invalid auth requirement for ${describeRoute(route)}. ` +
          "Use @Auth(), a non-empty strategy name, or an @AuthStrategy class token.",
      );
    }

    if (this.strategies.includes(token)) return token;

    throw new TypeError(
      `Unknown auth strategy ${token.name} for ${describeRoute(route)}. ` +
        `Available strategies: ${this.availableStrategies()}.`,
    );
  }

  private availableStrategies(): string {
    return [...this.names.keys()].toSorted(compareAlphabetically).join(", ") ||
      "none";
  }
}

function compareAlphabetically(left: string, right: string): number {
  return left.localeCompare(right);
}

function assertAuthStrategyToken(
  strategy: InjectionToken<AuthStrategyContract>,
): void {
  const metadata = getInjectableMetadata(strategy);
  if (
    metadata?.kind !== "auth-strategy" || !getAuthStrategyMetadata(strategy)
  ) {
    throw new TypeError(
      `Auth strategy ${strategy.name} must be decorated with @AuthStrategy before registration in createApp({ authStrategies: [...] }).`,
    );
  }
}

function strategyName(strategy: InjectionToken<AuthStrategyContract>): string {
  const configuredName = getAuthStrategyMetadata(strategy)?.name;
  if (configuredName?.trim() === "") {
    throw new TypeError(
      `Auth strategy ${strategy.name} has an empty strategy name. Use a non-empty @AuthStrategy({ name }) value.`,
    );
  }

  return configuredName?.trim() ?? strategy.name;
}

function describeRoute(route: AuthRouteDescriptor): string {
  const operation = route.operationId ? ` (${route.operationId})` : "";
  const controller = route.controller ? `${route.controller} ` : "";
  return `${controller}${route.method} ${route.path}${operation}`.trim();
}
