function trimTrailingSlashes(value: string): string {
  let end = value.length;

  while (end > 0 && value[end - 1] === "/") {
    end--;
  }

  return value.slice(0, end);
}

function trimLeadingSlashes(value: string): string {
  let start = 0;

  while (start < value.length && value[start] === "/") {
    start++;
  }

  return value.slice(start);
}

export function joinPaths(prefix: string, path: string): string {
  const normalizedPrefix = prefix === "/" ? "" : trimTrailingSlashes(prefix);
  const normalizedPath = path === "/" ? "" : trimLeadingSlashes(path);
  const joined = `${normalizedPrefix}/${normalizedPath}`;
  return joined === "/" ? joined : trimTrailingSlashes(joined);
}
