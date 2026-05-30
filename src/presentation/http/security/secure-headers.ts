import type { Middleware } from "../types.ts";
import { DEFAULT_SECURE_HEADERS } from "./default-secure-headers.constant.ts";
import { HEADER_NAMES } from "./header-names.constant.ts";
import type { SecureHeadersOptions } from "./secure-headers-options.interface.ts";

export function secureHeaders(options: SecureHeadersOptions = {}): Middleware {
  const headers = { ...DEFAULT_SECURE_HEADERS, ...options };

  return async (_ctx, next) => {
    const response = await next();

    for (const key of Object.keys(headers) as (keyof SecureHeadersOptions)[]) {
      const value = headers[key];
      if (value === false) continue;

      const headerName = HEADER_NAMES[key];
      if (!response.headers.has(headerName)) {
        response.headers.set(headerName, value);
      }
    }

    return response;
  };
}
