import { safeJsonValue } from "./safe-json-value.util.ts";

export function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(safeJsonValue(value));
  } catch (_error) {
    return JSON.stringify("[Unserializable]");
  }
}
