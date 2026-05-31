import type { BackgroundJobContext } from "./background-job-context.interface.ts";

export abstract class BackgroundJobBase {
  public abstract run(context: BackgroundJobContext): Promise<void> | void;
}
