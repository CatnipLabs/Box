import { markInjectable } from "../../core/di/index.ts";
import type { InjectionToken } from "../../core/di/index.ts";
import { BackgroundJobBase } from "./background-job-base.ts";
import type { BackgroundJobDecorator } from "./background-job-decorator.type.ts";
import { markBackgroundJob } from "./background-job-metadata-store.ts";
import type { BackgroundJobOptions } from "./background-job-options.interface.ts";

function createBackgroundJobDecorator(options: BackgroundJobOptions) {
  return (
    target: InjectionToken,
    context: ClassDecoratorContext,
  ): void => {
    if (context.kind !== "class") {
      throw new TypeError("@BackgroundJob can only decorate classes");
    }

    markBackgroundJob(target, options);
    markInjectable(target, "background-job", options);
  };
}

function BackgroundJobRuntime(
  this: BackgroundJobBase | undefined,
  options?: BackgroundJobOptions,
) {
  if (new.target) return;
  if (!options) throw new TypeError("@BackgroundJob requires options");

  return createBackgroundJobDecorator(options);
}

BackgroundJobRuntime.prototype = BackgroundJobBase.prototype;
Object.defineProperty(BackgroundJobRuntime, "name", { value: "BackgroundJob" });
Object.defineProperty(BackgroundJobRuntime.prototype, "constructor", {
  configurable: true,
  value: BackgroundJobRuntime,
  writable: true,
});
Object.setPrototypeOf(BackgroundJobRuntime, BackgroundJobBase);

export const BackgroundJob =
  BackgroundJobRuntime as unknown as BackgroundJobDecorator;
