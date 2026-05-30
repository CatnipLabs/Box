import type { KvEntry } from "./kv-entry.interface.ts";
import type { KvKey } from "./kv-key.type.ts";

export interface KvStore {
  get<TValue>(key: KvKey): Promise<{ value: TValue | null }>;
  set(key: KvKey, value: unknown): Promise<unknown>;
  delete(key: KvKey): Promise<unknown>;
  list<TValue>(options: { prefix: KvKey }): AsyncIterable<KvEntry<TValue>>;
}
