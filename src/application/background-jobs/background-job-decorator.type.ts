import type { InjectionToken } from "../../core/di/index.ts";
import type { BackgroundJobBase } from "./background-job-base.ts";
import type { BackgroundJobOptions } from "./background-job-options.interface.ts";

export type BackgroundJobDecorator = {
  new (): BackgroundJobBase;
  (options: BackgroundJobOptions): (
    target: InjectionToken,
    context: ClassDecoratorContext,
  ) => void;
};
