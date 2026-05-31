import { assert, assertEquals } from "@std/assert";
import {
  type BackgroundJobLockRecord,
  DenoKvBackgroundJobLock,
} from "../../../src/infra/background-jobs/deno-cron/index.ts";
import { FakeKv } from "../../fixtures/background-jobs/fake_kv.ts";

Deno.test("Deno Cron lock: only one owner acquires the same job lock", async () => {
  const kv = new FakeKv();
  const first = new DenoKvBackgroundJobLock({
    clock: () => kv.now(),
    kv,
    ownerId: "instance-a",
  });
  const second = new DenoKvBackgroundJobLock({
    clock: () => kv.now(),
    kv,
    ownerId: "instance-b",
  });

  const acquired = await first.acquire("catalog.sync", { leaseMs: 60_000 });
  const skipped = await second.acquire("catalog.sync", { leaseMs: 60_000 });

  assert(acquired.acquired);
  assertEquals(skipped.acquired, false);
});

Deno.test("Deno Cron lock: release is owner-safe", async () => {
  const kv = new FakeKv();
  const lock = new DenoKvBackgroundJobLock({
    clock: () => kv.now(),
    kv,
    ownerId: "instance-a",
  });
  const acquired = await lock.acquire("catalog.sync", { leaseMs: 60_000 });
  assert(acquired.acquired);

  const key = ["box", "background-jobs", "default", "catalog.sync", "lock"];
  kv.forceSet(key, {
    acquiredAt: kv.now().toISOString(),
    expiresAt: new Date(kv.now().getTime() + 60_000).toISOString(),
    jobName: "catalog.sync",
    ownerId: "instance-b",
    runId: "other-run",
  });

  assertEquals(await acquired.lock.release(), false);
  assertEquals(
    kv.recordValue<BackgroundJobLockRecord>(key)?.ownerId,
    "instance-b",
  );
});

Deno.test("Deno Cron lock: clock skew does not let another owner steal a live KV lease", async () => {
  const kv = new FakeKv();
  const first = new DenoKvBackgroundJobLock({
    clock: () => kv.now(),
    kv,
    ownerId: "instance-a",
  });
  const skewedSecond = new DenoKvBackgroundJobLock({
    clock: () => new Date(kv.now().getTime() + 120_000),
    kv,
    ownerId: "instance-b",
  });

  const acquired = await first.acquire("catalog.sync", { leaseMs: 60_000 });
  const skipped = await skewedSecond.acquire("catalog.sync", {
    leaseMs: 60_000,
  });

  assert(acquired.acquired);
  assertEquals(skipped.acquired, false);
});

Deno.test("Deno Cron lock: expired locks can be acquired again", async () => {
  const kv = new FakeKv();
  const first = new DenoKvBackgroundJobLock({
    clock: () => kv.now(),
    kv,
    ownerId: "instance-a",
  });
  const second = new DenoKvBackgroundJobLock({
    clock: () => kv.now(),
    kv,
    ownerId: "instance-b",
  });

  const acquired = await first.acquire("catalog.sync", { leaseMs: 100 });
  assert(acquired.acquired);
  kv.advance(101);

  const reacquired = await second.acquire("catalog.sync", { leaseMs: 100 });
  assert(reacquired.acquired);
  assertEquals(reacquired.lock.ownerId, "instance-b");
});

Deno.test("Deno Cron lock: namespaces isolate the same job name", async () => {
  const kv = new FakeKv();
  const production = new DenoKvBackgroundJobLock({
    clock: () => kv.now(),
    kv,
    namespace: "production",
    ownerId: "instance-a",
  });
  const staging = new DenoKvBackgroundJobLock({
    clock: () => kv.now(),
    kv,
    namespace: "staging",
    ownerId: "instance-b",
  });

  const first = await production.acquire("catalog.sync", { leaseMs: 60_000 });
  const second = await staging.acquire("catalog.sync", { leaseMs: 60_000 });

  assert(first.acquired);
  assert(second.acquired);
});

Deno.test("Deno Cron lock: renew extends ownership only for the current owner", async () => {
  const kv = new FakeKv();
  const lock = new DenoKvBackgroundJobLock({
    clock: () => kv.now(),
    kv,
    ownerId: "instance-a",
  });
  const acquired = await lock.acquire("catalog.sync", { leaseMs: 60_000 });
  assert(acquired.acquired);

  assertEquals(await acquired.lock.renew(), true);

  const key = ["box", "background-jobs", "default", "catalog.sync", "lock"];
  kv.forceSet(key, {
    acquiredAt: kv.now().toISOString(),
    expiresAt: new Date(kv.now().getTime() + 60_000).toISOString(),
    jobName: "catalog.sync",
    ownerId: "instance-b",
    runId: "other-run",
  });

  assertEquals(await acquired.lock.renew(), false);
});
