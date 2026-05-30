export function safeJsonValue(value: unknown): unknown {
  return cloneJsonValue(value, new WeakSet<object>());
}

function cloneJsonValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function" || typeof value === "symbol") {
    return String(value);
  }
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
    };
  }
  if (hasOwnToJson(value)) {
    return cloneJsonValue(value.toJSON(), seen);
  }
  if (seen.has(value)) return "[Circular]";

  seen.add(value);

  if (Array.isArray(value)) {
    const array = value.map((item) => cloneJsonValue(item, seen));
    seen.delete(value);
    return array;
  }

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    output[key] = cloneJsonValue(item, seen);
  }

  seen.delete(value);
  return output;
}

function hasOwnToJson(
  value: object,
): value is { toJSON: () => unknown } {
  return Object.prototype.hasOwnProperty.call(value, "toJSON") &&
    typeof (value as { toJSON?: unknown }).toJSON === "function";
}
