export function joinPaths(prefix: string, path: string): string {
  const normalizedPrefix = prefix === "/" ? "" : prefix.replace(/\/+$/, "");
  const normalizedPath = path === "/" ? "" : path.replace(/^\/+/, "");
  const joined = `${normalizedPrefix}/${normalizedPath}`;
  return joined === "/" ? joined : joined.replace(/\/+$/, "");
}
