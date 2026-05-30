import type { DocsOptions } from "./docs-options.interface.ts";

export interface AppOptions {
  readonly docs?: DocsOptions | false;
}
