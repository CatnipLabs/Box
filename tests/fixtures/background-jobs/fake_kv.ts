type StoredRecord = {
  readonly expiresAt?: number;
  readonly value: unknown;
  readonly versionstamp: string;
};

type Check = {
  readonly key: Deno.KvKey;
  readonly versionstamp: string | null;
};

type Mutation =
  | {
    readonly kind: "set";
    readonly key: Deno.KvKey;
    readonly options?: { readonly expireIn?: number };
    readonly value: unknown;
  }
  | { readonly kind: "delete"; readonly key: Deno.KvKey };

export class FakeKv {
  private nowMs = Date.parse("2026-05-30T20:00:00.000Z");
  private nextVersion = 1;
  private readonly records = new Map<string, StoredRecord>();

  public now(): Date {
    return new Date(this.nowMs);
  }

  public advance(ms: number): void {
    this.nowMs += ms;
  }

  public get<T>(key: Deno.KvKey): Promise<Deno.KvEntryMaybe<T>> {
    this.purgeExpired();
    const record = this.records.get(keyToString(key));
    if (!record) {
      return Promise.resolve({ key, value: null, versionstamp: null });
    }

    return Promise.resolve({
      key,
      value: record.value as T,
      versionstamp: record.versionstamp,
    });
  }

  public atomic(): FakeAtomicOperation {
    return new FakeAtomicOperation(this);
  }

  public forceSet(
    key: Deno.KvKey,
    value: unknown,
    options: { readonly expireIn?: number } = {},
  ): void {
    this.setRecord(key, value, options);
  }

  public has(key: Deno.KvKey): boolean {
    this.purgeExpired();
    return this.records.has(keyToString(key));
  }

  public recordValue<T>(key: Deno.KvKey): T | undefined {
    this.purgeExpired();
    return this.records.get(keyToString(key))?.value as T | undefined;
  }

  public commit(
    checks: readonly Check[],
    mutations: readonly Mutation[],
  ): Deno.KvCommitResult | Deno.KvCommitError {
    this.purgeExpired();

    for (const check of checks) {
      const current = this.records.get(keyToString(check.key));
      const currentVersion = current?.versionstamp ?? null;
      if (currentVersion !== check.versionstamp) {
        return { ok: false };
      }
    }

    for (const mutation of mutations) {
      if (mutation.kind === "delete") {
        this.records.delete(keyToString(mutation.key));
        continue;
      }

      this.setRecord(mutation.key, mutation.value, mutation.options);
    }

    return {
      ok: true,
      versionstamp: this.createVersionstamp(),
    };
  }

  private setRecord(
    key: Deno.KvKey,
    value: unknown,
    options: { readonly expireIn?: number } = {},
  ): void {
    const expiresAt = options.expireIn === undefined
      ? undefined
      : this.nowMs + options.expireIn;
    this.records.set(keyToString(key), {
      expiresAt,
      value,
      versionstamp: this.createVersionstamp(),
    });
  }

  private createVersionstamp(): string {
    const stamp = this.nextVersion.toString().padStart(20, "0");
    this.nextVersion += 1;
    return stamp;
  }

  private purgeExpired(): void {
    for (const [key, record] of this.records) {
      if (record.expiresAt !== undefined && record.expiresAt <= this.nowMs) {
        this.records.delete(key);
      }
    }
  }
}

export class FakeAtomicOperation {
  private readonly checks: Check[] = [];
  private readonly mutations: Mutation[] = [];

  public constructor(private readonly kv: FakeKv) {}

  public check(check: Check): this {
    this.checks.push(check);
    return this;
  }

  public set(
    key: Deno.KvKey,
    value: unknown,
    options?: { readonly expireIn?: number },
  ): this {
    this.mutations.push({ kind: "set", key, options, value });
    return this;
  }

  public delete(key: Deno.KvKey): this {
    this.mutations.push({ kind: "delete", key });
    return this;
  }

  public commit(): Promise<Deno.KvCommitResult | Deno.KvCommitError> {
    return Promise.resolve(this.kv.commit(this.checks, this.mutations));
  }
}

function keyToString(key: Deno.KvKey): string {
  return JSON.stringify(key);
}
