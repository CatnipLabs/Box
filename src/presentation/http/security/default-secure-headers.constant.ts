import type { SecureHeadersOptions } from "./secure-headers-options.interface.ts";

export const DEFAULT_SECURE_HEADERS: Required<SecureHeadersOptions> = {
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: "same-origin",
  crossOriginResourcePolicy: "same-origin",
  referrerPolicy: "no-referrer",
  xContentTypeOptions: "nosniff",
  xDnsPrefetchControl: "off",
  xFrameOptions: "DENY",
};
