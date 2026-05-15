/**
 * Tests for src/lib/tool-call-batcher.ts — Cook 111.
 */

import { describe, it, expect, vi } from "vitest";
import {
  dispatchBatched,
  type BatchAdapter,
  type SingleCall,
} from "../tool-call-batcher";

interface Echo {
  echoed: string;
}

function adapter(
  name: string,
  opts: { batchable?: boolean } = {},
): BatchAdapter<string, Echo> {
  const ad: BatchAdapter<string, Echo> = {
    name,
    single: vi.fn(async (s: string) => ({ echoed: `s:${s}` })),
  };
  if (opts.batchable) {
    ad.batch = vi.fn(async (ss: string[]) =>
      ss.map((s) => ({ echoed: `b:${s}` })),
    );
  }
  return ad;
}

describe("dispatchBatched — batching", () => {
  it("batches same-named calls when adapter exposes batch()", async () => {
    const ad = adapter("rag", { batchable: true });
    const adapters = new Map([[ad.name, ad]]);
    const calls: SingleCall<string, Echo>[] = [
      { name: "rag", args: "a" },
      { name: "rag", args: "b" },
      { name: "rag", args: "c" },
    ];
    const r = await dispatchBatched(calls, adapters);
    expect(r.outputs.length).toBe(3);
    expect(r.outputs[0].echoed).toBe("b:a");
    expect(r.batched).toEqual([true, true, true]);
    expect(ad.batch).toHaveBeenCalledTimes(1);
    expect(ad.single).not.toHaveBeenCalled();
  });

  it("falls back to single() when adapter doesn't expose batch()", async () => {
    const ad = adapter("fetch");
    const adapters = new Map([[ad.name, ad]]);
    const r = await dispatchBatched(
      [
        { name: "fetch", args: "a" },
        { name: "fetch", args: "b" },
      ],
      adapters,
    );
    expect(r.batched).toEqual([false, false]);
    expect(ad.single).toHaveBeenCalledTimes(2);
  });

  it("uses single() when there's only one call (no batch overhead)", async () => {
    const ad = adapter("rag", { batchable: true });
    const adapters = new Map([[ad.name, ad]]);
    const r = await dispatchBatched(
      [{ name: "rag", args: "lonely" }],
      adapters,
    );
    expect(r.batched).toEqual([false]);
    expect(ad.batch).not.toHaveBeenCalled();
    expect(ad.single).toHaveBeenCalledTimes(1);
  });
});

describe("dispatchBatched — mixed names", () => {
  it("groups by name and preserves original output order", async () => {
    const rag = adapter("rag", { batchable: true });
    const fetcher = adapter("fetch");
    const adapters = new Map([
      [rag.name, rag],
      [fetcher.name, fetcher],
    ]);
    const r = await dispatchBatched(
      [
        { name: "rag", args: "q1" },
        { name: "fetch", args: "u1" },
        { name: "rag", args: "q2" },
        { name: "fetch", args: "u2" },
      ],
      adapters,
    );
    expect(r.outputs[0].echoed).toBe("b:q1");
    expect(r.outputs[1].echoed).toBe("s:u1");
    expect(r.outputs[2].echoed).toBe("b:q2");
    expect(r.outputs[3].echoed).toBe("s:u2");
    expect(r.batched).toEqual([true, false, true, false]);
  });
});

describe("dispatchBatched — unknown tool", () => {
  it("returns unknown-tool outcome for missing adapter", async () => {
    const r = await dispatchBatched([{ name: "ghost", args: "x" }], new Map());
    const o = r.outputs[0] as unknown as { outcome: string };
    expect(o.outcome).toBe("unknown-tool");
  });
});

describe("dispatchBatched — batch failure falls back to single", () => {
  it("falls back when batch() throws", async () => {
    const failingBatch: BatchAdapter<string, Echo> = {
      name: "rag",
      batch: vi.fn().mockRejectedValue(new Error("batch endpoint down")),
      single: vi.fn(async (s: string) => ({ echoed: `s:${s}` })),
    };
    const r = await dispatchBatched(
      [
        { name: "rag", args: "a" },
        { name: "rag", args: "b" },
      ],
      new Map([[failingBatch.name, failingBatch]]),
    );
    expect(r.outputs[0].echoed).toBe("s:a");
    expect(r.outputs[1].echoed).toBe("s:b");
    expect(failingBatch.single).toHaveBeenCalledTimes(2);
  });
});

describe("dispatchBatched — latency win", () => {
  it("batched path is faster than serial for slow adapters", async () => {
    const slowAdapter: BatchAdapter<string, Echo> = {
      name: "slow",
      batch: vi.fn(async (ss: string[]) => {
        await new Promise((r) => setTimeout(r, 40));
        return ss.map((s) => ({ echoed: s }));
      }),
      single: vi.fn(async (s: string) => {
        await new Promise((r) => setTimeout(r, 40));
        return { echoed: s };
      }),
    };
    const adapters = new Map([[slowAdapter.name, slowAdapter]]);
    const start = Date.now();
    const calls: SingleCall<string, Echo>[] = Array.from(
      { length: 5 },
      (_, i) => ({ name: "slow", args: `x-${i}` }),
    );
    await dispatchBatched(calls, adapters);
    const elapsed = Date.now() - start;
    // 5 batched calls of 40ms = 40ms+, NOT 200ms.
    expect(elapsed).toBeLessThan(120);
  });
});
