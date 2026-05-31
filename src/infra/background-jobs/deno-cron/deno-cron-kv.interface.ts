import type { DenoCronAtomicOperation } from "./deno-cron-atomic-operation.interface.ts";

export interface DenoCronKv {
  atomic(): DenoCronAtomicOperation;
  get<T = unknown>(key: Deno.KvKey): Promise<Deno.KvEntryMaybe<T>>;
}
