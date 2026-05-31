export interface DenoCronAtomicOperation {
  check(check: Deno.AtomicCheck): DenoCronAtomicOperation;
  delete(key: Deno.KvKey): DenoCronAtomicOperation;
  set(
    key: Deno.KvKey,
    value: unknown,
    options?: { readonly expireIn?: number },
  ): DenoCronAtomicOperation;
  commit(): Promise<Deno.KvCommitResult | Deno.KvCommitError>;
}
