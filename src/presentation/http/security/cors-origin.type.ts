export type CorsOrigin =
  | "*"
  | string
  | string[]
  | ((origin: string | null) => string | boolean | null | undefined);
