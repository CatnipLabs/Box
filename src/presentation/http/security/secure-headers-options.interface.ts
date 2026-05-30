export interface SecureHeadersOptions {
  contentSecurityPolicy?: string | false;
  crossOriginOpenerPolicy?: string | false;
  crossOriginResourcePolicy?: string | false;
  referrerPolicy?: string | false;
  xContentTypeOptions?: string | false;
  xDnsPrefetchControl?: string | false;
  xFrameOptions?: string | false;
}
