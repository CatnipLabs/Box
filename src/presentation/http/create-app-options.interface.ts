import type {
  ConsumerBase,
  MessagingRuntimeOptions,
  ProducerBase,
} from "../../application/messaging/index.ts";
import type { AuthStrategyContract } from "./auth/index.ts";
import type { InjectionToken, Provider } from "../../core/di/index.ts";
import type { AppOptions } from "./docs/index.ts";

export interface CreateAppOptions extends AppOptions {
  readonly authStrategies?: readonly InjectionToken<AuthStrategyContract>[];
  readonly consumers?: readonly InjectionToken<ConsumerBase>[];
  readonly controllers: readonly InjectionToken<object>[];
  readonly producers?: readonly InjectionToken<ProducerBase>[];
  readonly providers?: readonly Provider[];
  readonly queues?: MessagingRuntimeOptions;
  readonly repositories?: readonly InjectionToken[];
  readonly services?: readonly InjectionToken[];
}
