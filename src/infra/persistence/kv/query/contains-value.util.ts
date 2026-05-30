export function containsValue(actual: unknown, expected: unknown): boolean {
  if (typeof actual === "string") {
    return actual.includes(String(expected));
  }

  if (Array.isArray(actual)) {
    return actual.some((item) => Object.is(item, expected));
  }

  return false;
}
