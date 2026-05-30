export function isCorsPreflight(request: Request): boolean {
  return request.method.toUpperCase() === "OPTIONS" &&
    request.headers.has("access-control-request-method");
}
