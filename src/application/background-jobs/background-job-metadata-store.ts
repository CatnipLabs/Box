import type { InjectionToken } from "../../core/di/index.ts";
import type { BackgroundJobMetadata } from "./background-job-metadata.interface.ts";
import type { BackgroundJobOptions } from "./background-job-options.interface.ts";

const MAX_BACKOFF_DELAY_MS = 3_600_000;
const MAX_BACKOFF_RETRIES = 5;
const backgroundJobMetadata = new WeakMap<
  InjectionToken,
  BackgroundJobMetadata
>();

export function markBackgroundJob(
  target: InjectionToken,
  options: BackgroundJobOptions,
): void {
  validateBackgroundJobOptions(options);

  backgroundJobMetadata.set(target, {
    backoffSchedule: options.backoffSchedule,
    dependencies: options.deps ?? options.inject ?? options.dependencies ?? [],
    lock: options.lock,
    name: options.name.trim(),
    schedule: typeof options.schedule === "string"
      ? options.schedule.trim()
      : options.schedule,
  });
}

export function getBackgroundJobMetadata(
  target: InjectionToken,
): BackgroundJobMetadata | undefined {
  return backgroundJobMetadata.get(target);
}

function validateBackgroundJobOptions(options: BackgroundJobOptions): void {
  if (options.name.trim().length === 0) {
    throw new TypeError("Background job name must be a non-empty string");
  }

  if (
    typeof options.schedule === "string" && options.schedule.trim().length === 0
  ) {
    throw new TypeError(
      "Background job schedule must be a non-empty cron expression",
    );
  }

  validateBackoffSchedule(options.backoffSchedule);
  validateLockOptions(options.lock);
}

function validateLockOptions(
  lock: { readonly leaseMs?: number } | undefined,
): void {
  if (lock?.leaseMs === undefined) return;

  if (!Number.isFinite(lock.leaseMs) || lock.leaseMs <= 0) {
    throw new TypeError(
      "Background job lock leaseMs must be a positive finite number",
    );
  }
}

function validateBackoffSchedule(
  schedule: readonly number[] | undefined,
): void {
  if (!schedule) return;

  if (schedule.length > MAX_BACKOFF_RETRIES) {
    throw new TypeError(
      "Background job backoffSchedule supports at most 5 retries",
    );
  }

  for (const delay of schedule) {
    if (!Number.isFinite(delay) || delay <= 0 || delay > MAX_BACKOFF_DELAY_MS) {
      throw new TypeError(
        "Background job backoffSchedule delays must be between 1 and 3600000 milliseconds",
      );
    }
  }
}
