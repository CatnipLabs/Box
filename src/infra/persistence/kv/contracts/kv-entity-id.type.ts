import type { KvKeyPart } from "./kv-key-part.type.ts";

export type KvEntityId = Exclude<KvKeyPart, Uint8Array>;
