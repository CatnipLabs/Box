import type {
  KvKey,
  KvKeyPart,
  KvStore,
} from "../../../src/infra/persistence/kv/index.ts";

interface MemoryKvRecord {
  key: KvKey;
  value: unknown;
}

export class MemoryKv implements KvStore {
  private readonly values = new Map<string, MemoryKvRecord>();

  public async get<T>(key: KvKey): Promise<{ value: T | null }> {
    await Promise.resolve();
    const record = this.values.get(serializeKey(key));
    return {
      value: record ? cloneValue<T>(record.value) : null,
    };
  }

  public async set(key: KvKey, value: unknown): Promise<void> {
    await Promise.resolve();
    if (value === undefined) {
      throw new TypeError("Deno KV does not accept undefined values");
    }

    this.values.set(serializeKey(key), {
      key: cloneKey(key),
      value: cloneValue(value),
    });
  }

  public async delete(key: KvKey): Promise<void> {
    await Promise.resolve();
    this.values.delete(serializeKey(key));
  }

  public async *list<T>(options: { prefix: KvKey }): AsyncIterable<{
    key: KvKey;
    value: T;
  }> {
    await Promise.resolve();
    const matchingRecords = [...this.values.entries()]
      .filter(([, record]) => matchesPrefix(record.key, options.prefix))
      .sort(([left], [right]) => left.localeCompare(right));

    for (const [, record] of matchingRecords) {
      yield {
        key: cloneKey(record.key),
        value: cloneValue<T>(record.value),
      };
    }
  }
}

function serializeKey(key: KvKey): string {
  return key.map(serializeKeyPart).join("|");
}

function serializeKeyPart(part: KvKeyPart): string {
  if (typeof part === "bigint") return `bigint:${part}`;
  if (typeof part === "boolean") return `boolean:${part}`;
  if (typeof part === "number") return `number:${part}`;
  if (typeof part === "string") return `string:${JSON.stringify(part)}`;
  return `uint8array:${Array.from(part).join(",")}`;
}

function matchesPrefix(key: KvKey, prefix: KvKey): boolean {
  return prefix.every((part, index) => keyPartEquals(key[index], part));
}

function keyPartEquals(left: KvKeyPart | undefined, right: KvKeyPart): boolean {
  if (left instanceof Uint8Array && right instanceof Uint8Array) {
    return left.length === right.length &&
      left.every((value, index) => value === right[index]);
  }

  return Object.is(left, right);
}

function cloneKey(key: KvKey): KvKey {
  return key.map((part) => cloneValue<KvKeyPart>(part));
}

function cloneValue<T>(value: unknown): T {
  return structuredClone(value) as T;
}
