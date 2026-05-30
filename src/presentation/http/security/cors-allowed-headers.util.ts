export function corsAllowedHeaders(
  request: Request,
  allowedHeaders?: string[],
): string {
  if (allowedHeaders && allowedHeaders.length > 0) {
    return allowedHeaders.join(", ");
  }

  return request.headers.get("access-control-request-headers") ?? "";
}
