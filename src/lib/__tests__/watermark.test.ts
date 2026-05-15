/**
 * Tests for src/lib/watermark.ts — Cook 95.
 */

import { describe, it, expect } from "vitest";
import { countMarkers, embed, verify } from "../watermark";

const BASE = {
  tenantId: "tenant-1",
  agentSlug: "lead-blitz",
  receiptId: "rcpt-abc-123",
  secret: "test-secret",
};

const SAMPLE_TEXT =
  "Sovereign Matrix produces cryptographically signed receipts so every regulator can replay the exact AI decision at any time.";

describe("embed", () => {
  it("returns text visually identical (no character class added beyond ZWJ)", () => {
    const r = embed({ ...BASE, text: SAMPLE_TEXT });
    expect(r.marked.replace(/‍/g, "")).toBe(SAMPLE_TEXT);
  });

  it("requires a secret", () => {
    expect(() => embed({ ...BASE, secret: "", text: SAMPLE_TEXT })).toThrow();
  });

  it("is deterministic for the same args", () => {
    const a = embed({ ...BASE, text: SAMPLE_TEXT });
    const b = embed({ ...BASE, text: SAMPLE_TEXT });
    expect(a.marked).toBe(b.marked);
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it("emits different fingerprints across receipts", () => {
    const a = embed({ ...BASE, text: SAMPLE_TEXT });
    const b = embed({ ...BASE, receiptId: "rcpt-xyz", text: SAMPLE_TEXT });
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });

  it("returns positionsMarked > 0 for normal-sized text", () => {
    const r = embed({ ...BASE, text: SAMPLE_TEXT });
    expect(r.positionsMarked).toBeGreaterThan(0);
  });

  it("clamps the positions count to the configured maximum", () => {
    const r = embed({ ...BASE, text: SAMPLE_TEXT, positions: 1000 });
    expect(r.positionsMarked).toBeLessThanOrEqual(32);
  });
});

describe("countMarkers + verify", () => {
  it("countMarkers reflects the number of inserted ZWJ chars", () => {
    const r = embed({ ...BASE, text: SAMPLE_TEXT });
    expect(countMarkers(r.marked)).toBe(r.positionsMarked);
  });

  it("verify returns true for unmodified marked text", () => {
    const r = embed({ ...BASE, text: SAMPLE_TEXT });
    expect(verify(r.marked, BASE)).toBe(true);
  });

  it("verify returns false if any ZWJ was removed", () => {
    const r = embed({ ...BASE, text: SAMPLE_TEXT });
    // Strip the first ZWJ → pattern breaks.
    const broken = r.marked.replace(/‍/, "");
    expect(verify(broken, BASE)).toBe(false);
  });

  it("verify returns false under a different tenant", () => {
    const r = embed({ ...BASE, text: SAMPLE_TEXT });
    expect(verify(r.marked, { ...BASE, tenantId: "other" })).toBe(false);
  });
});
