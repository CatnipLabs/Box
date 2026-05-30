import type { DenoQueueKv } from "../../../src/infra/messaging/deno-queues/index.ts";

export class FakeKvQueue implements DenoQueueKv {
  public readonly enqueued: Array<
    { value: unknown; options?: DenoQueueOptions }
  > = [];
  public handler?: (value: unknown) => Promise<void> | void;

  public enqueue(
    value: unknown,
    options?: DenoQueueOptions,
  ): Promise<Deno.KvCommitResult> {
    this.enqueued.push({ value, options });
    return Promise.resolve({ ok: true, versionstamp: "00000000000000010000" });
  }

  public listenQueue(
    handler: (value: unknown) => Promise<void> | void,
  ): Promise<void> {
    this.handler = handler;
    return Promise.resolve();
  }

  public async deliver(value: unknown): Promise<void> {
    if (!this.handler) throw new Error("No queue handler registered");
    await this.handler(value);
  }
}

type DenoQueueOptions = Parameters<DenoQueueKv["enqueue"]>[1];
