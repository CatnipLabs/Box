import type {
  BackgroundJobLockOptions,
  BackgroundJobRuntimeOptions,
} from "../../../application/background-jobs/index.ts";
import type { DenoCronFunction } from "./deno-cron-function.type.ts";
import type { DenoCronKv } from "./deno-cron-kv.interface.ts";

export interface DenoCronOptions extends BackgroundJobRuntimeOptions {
  readonly clock?: () => Date;
  readonly cron?: DenoCronFunction;
  readonly instanceId?: string;
  readonly kv: DenoCronKv;
  readonly lockDefaults?: BackgroundJobLockOptions;
  readonly namespace?: string;
}
