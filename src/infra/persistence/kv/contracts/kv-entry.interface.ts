import type { KvKey } from "./kv-key.type.ts";

export interface KvEntry<TValue> {
  key: KvKey;
  value: TValue;
}
