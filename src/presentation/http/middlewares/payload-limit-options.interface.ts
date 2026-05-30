export interface PayloadLimitOptions {
  readonly jsonMaxBytes?: number;
  readonly uploadMaxBytes?: number;
  readonly defaultMaxBytes?: number;
  readonly uploadContentTypes?: readonly string[];
  readonly methods?: readonly string[];
}
