/**
 * Tests for src/lib/cost-ledger.ts
 *
 * Regression coverage: nvidia.ts lazy-imports this module after every chat
 * completion to log token counts. Failure to import or a thrown exception
 * here would silently kill every NIM call (the call site has a try/catch,
 * but a missing module is still a real bug — see git history).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  recordLedgerEntry,
  getRecentLedgerEntries,
  onLedgerEntry,
  resetCostLedger,
} from "@/lib/cost-ledger";

describe("cost-ledger", () => {
  beforeEach(() => {
    resetCostLedger();
  });

  it("records entries to the ring buffer", () => {
    recordLedgerEntry({
      modelId: "nvidia/llama-3.1-nemotron-ultra-253b-v1",
      inputTokens: 100,
      outputTokens: 50,
    });
    const entries = getRecentLedgerEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].modelId).toBe("nvidia/llama-3.1-nemotron-ultra-253b-v1");
    expect(entries[0].inputTokens).toBe(100);
    expect(entries[0].timestamp).toBeTypeOf("number");
  });

  it("ignores entries with empty / missing modelId", () => {
    recordLedgerEntry({ modelId: "" });
    // @ts-expect-error — testing runtime safety
    recordLedgerEntry(null);
    // @ts-expect-error — testing runtime safety
    recordLedgerEntry({ inputTokens: 5 });
    expect(getRecentLedgerEntries()).toHaveLength(0);
  });

  it("notifies subscribers", () => {
    const fn = vi.fn();
    const unsubscribe = onLedgerEntry(fn);

    recordLedgerEntry({ modelId: "claude-sonnet-4-6", inputTokens: 200 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.calls[0][0].modelId).toBe("claude-sonnet-4-6");

    unsubscribe();
    recordLedgerEntry({ modelId: "claude-sonnet-4-6", inputTokens: 300 });
    expect(fn).toHaveBeenCalledTimes(1); // not called after unsubscribe
  });

  it("swallows subscriber errors so the producer keeps working", () => {
    const fn1 = vi.fn(() => {
      throw new Error("subscriber blew up");
    });
    const fn2 = vi.fn();
    onLedgerEntry(fn1);
    onLedgerEntry(fn2);

    expect(() =>
      recordLedgerEntry({ modelId: "claude-sonnet-4-6" }),
    ).not.toThrow();
    expect(fn2).toHaveBeenCalled();
  });

  it("caps ring buffer at 256 entries", () => {
    for (let i = 0; i < 300; i++) {
      recordLedgerEntry({ modelId: `model-${i}` });
    }
    const entries = getRecentLedgerEntries();
    expect(entries.length).toBeLessThanOrEqual(256);
    // Most-recent entry should be retained
    expect(entries[entries.length - 1].modelId).toBe("model-299");
  });
});
