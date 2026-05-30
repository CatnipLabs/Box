import type { SecureHeadersOptions } from "./secure-headers-options.interface.ts";

export const HEADER_NAMES: Record<keyof SecureHeadersOptions, string> = {
  contentSecurityPolicy: "content-security-policy",
  crossOriginOpenerPolicy: "cross-origin-opener-policy",
  crossOriginResourcePolicy: "cross-origin-resource-policy",
  referrerPolicy: "referrer-policy",
  xContentTypeOptions: "x-content-type-options",
  xDnsPrefetchControl: "x-dns-prefetch-control",
  xFrameOptions: "x-frame-options",
};
