import type { OpenApiServer } from "./openapi-server.interface.ts";
import type { ScalarOptions } from "./scalar-options.interface.ts";

export interface DocsOptions {
  readonly enabled?: boolean;
  readonly title?: string;
  readonly version?: string;
  readonly description?: string;
  readonly path?: string;
  readonly openApiPath?: string;
  readonly servers?: OpenApiServer[];
  readonly scalar?: ScalarOptions;
}
