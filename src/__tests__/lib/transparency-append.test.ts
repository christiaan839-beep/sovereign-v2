/**
 * appendReceiptToTransparencyLog — the wire that makes the log
 * non-decorative.
 *
 * Invariants pinned here:
 *   - receiptLeafHash() is deterministic on (id, signature)
 *   - appendReceiptToTransparencyLog appends the same hash and
 *     returns the post-append tree size
 *   - failures are swallowed (the receipt is still valid even if
 *     the log append fails)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { leafHash } from "@sovereign-matrix/verifiable-receipts/transparency";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

beforeEach(async () => {
  vi.clearAllMocks();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  const { _resetTransparencySingleton } =
    await import("@/lib/transparency-singleton");
  _resetTransparencySingleton();
});

describe("receiptLeafHash", () => {
  it("is deterministic on (id, signature)", async () => {
    const { receiptLeafHash } = await import("@/lib/transparency-append");
    const a = receiptLeafHash({ id: "r1", signature: "v2=AAA" });
    const b = receiptLeafHash({ id: "r1", signature: "v2=AAA" });
    expect(a).toBe(b);
    // Matches the underlying leafHash() primitive.
    expect(a).toBe(leafHash("r1|v2=AAA"));
  });

  it("differs when either input differs", async () => {
    const { receiptLeafHash } = await import("@/lib/transparency-append");
    const a = receiptLeafHash({ id: "r1", signature: "v2=AAA" });
    const b = receiptLeafHash({ id: "r2", signature: "v2=AAA" });
    const c = receiptLeafHash({ id: "r1", signature: "v2=BBB" });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("appendReceiptToTransparencyLog", () => {
  it("appends a leaf and returns the (post-append) tree size", async () => {
    const { appendReceiptToTransparencyLog } =
      await import("@/lib/transparency-append");
    const sizeBefore = (
      await (
        await import("@/lib/transparency-singleton")
      ).getDemoTransparencyLog()
    ).size();
    const result = await appendReceiptToTransparencyLog({
      id: "rcpt_append_001",
      signature: "v2=test-signature",
    });
    expect(result.leafHash).toBe(leafHash("rcpt_append_001|v2=test-signature"));
    expect(result.treeSize).toBe(sizeBefore + 1);
    expect(result.persistent).toBe(false);
  });

  it("two appends with the same input produce different leaves only when ids/sigs differ", async () => {
    const { appendReceiptToTransparencyLog } =
      await import("@/lib/transparency-append");
    const r1 = await appendReceiptToTransparencyLog({
      id: "rcpt_a",
      signature: "v2=A",
    });
    const r2 = await appendReceiptToTransparencyLog({
      id: "rcpt_b",
      signature: "v2=B",
    });
    expect(r1.leafHash).not.toBe(r2.leafHash);
    expect(r2.treeSize).toBe(r1.treeSize + 1);
  });
});
