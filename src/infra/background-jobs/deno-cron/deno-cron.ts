import { DenoCronRuntime } from "./deno-cron-runtime.ts";
import type { DenoCronOptions } from "./deno-cron-options.interface.ts";

export function denoCron(
  options: Omit<DenoCronOptions, "createRuntime">,
): DenoCronOptions {
  const normalized: DenoCronOptions = {
    ...options,
    cron: options.cron ?? denoCronFunction,
    createRuntime: () => new DenoCronRuntime(normalized),
  };

  return normalized;
}

const denoCronFunction: NonNullable<DenoCronOptions["cron"]> = (
  name,
  schedule,
  options,
  handler,
) => {
  const cronOptions = {
    ...options,
    backoffSchedule: options.backoffSchedule
      ? [...options.backoffSchedule]
      : undefined,
  };
  return Deno.cron(name, schedule, cronOptions, handler);
};
