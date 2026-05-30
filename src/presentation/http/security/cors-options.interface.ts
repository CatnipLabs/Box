import type { CorsOrigin } from "./cors-origin.type.ts";

export interface CorsOptions {
  origin?: CorsOrigin;
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}
