/**
 * Tests for src/lib/api-key-rotation.ts — Cook 125.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  _resetForTests,
  API_KEY_CONSTANTS,
  listFor,
  mint,
  revoke,
  rotate,
  verify,
} from "../api-key-rotation";

beforeEach(() => {
  _resetForTests();
});

describe("mint", () => {
  it("rejects missing tenantId / label", () => {
    expect(() => mint({ tenantId: "", label: "x" })).toThrow();
    expect(() => mint({ tenantId: "t", label: "" })).toThrow();
    expect(() => mint({ tenantId: "t", label: "x".repeat(81) })).toThrow();
  });

  it("returns cleartext starting with the public prefix", () => {
    const { cleartext, record } = mint({ tenantId: "t", label: "test" });
    expect(cleartext.startsWith(API_KEY_CONSTANTS.TOKEN_PREFIX)).toBe(true);
    expect(record.prefix.length).toBe(12);
    expect(record.status).toBe("active");
  });

  it("stores hash, not cleartext", () => {
    const { cleartext, record } = mint({ tenantId: "t", label: "test" });
    expect(record.hash).not.toBe(cleartext);
  });
});

describe("verify — active", () => {
  it("matches the issued cleartext", () => {
    const { cleartext, record } = mint({ tenantId: "t", label: "x" });
    const matched = verify(cleartext);
    expect(matched?.id).toBe(record.id);
    expect(matched?.lastUsedAt).toBeGreaterThan(0);
  });

  it("rejects unknown tokens", () => {
    mint({ tenantId: "t", label: "x" });
    expect(verify(`${API_KEY_CONSTANTS.TOKEN_PREFIX}garbage`)).toBeNull();
  });

  it("rejects wrong-prefix tokens", () => {
    mint({ tenantId: "t", label: "x" });
    expect(verify("not-a-key")).toBeNull();
  });
});

describe("rotate — overlapping window", () => {
  it("keeps the old key valid during grace period", () => {
    const { cleartext: oldCt, record: oldRec } = mint({
      tenantId: "t",
      label: "x",
      now: 1000,
    });
    const { fresh, retiring } = rotate({
      oldKeyId: oldRec.id,
      now: 1000,
      config: { gracePeriodMs: 60_000 },
    });
    expect(retiring.status).toBe("retiring");
    expect(retiring.retiresAt).toBe(61_000);

    // Both keys valid inside the window.
    expect(verify(oldCt, 30_000)).not.toBeNull();
    expect(verify(fresh.cleartext, 30_000)).not.toBeNull();
  });

  it("old key stops verifying after retiresAt", () => {
    const { cleartext: oldCt, record: oldRec } = mint({
      tenantId: "t",
      label: "x",
      now: 1000,
    });
    rotate({
      oldKeyId: oldRec.id,
      now: 1000,
      config: { gracePeriodMs: 60_000 },
    });
    expect(verify(oldCt, 1_000_000)).toBeNull();
  });

  it("throws on rotating a revoked key", () => {
    const { record } = mint({ tenantId: "t", label: "x" });
    revoke(record.id);
    expect(() => rotate({ oldKeyId: record.id })).toThrow();
  });

  it("throws on rotating an unknown key", () => {
    expect(() => rotate({ oldKeyId: "missing" })).toThrow();
  });
});

describe("revoke", () => {
  it("kills the key immediately — no grace", () => {
    const { cleartext, record } = mint({ tenantId: "t", label: "x" });
    expect(revoke(record.id)).toBe(true);
    expect(verify(cleartext)).toBeNull();
  });

  it("returns false on missing id", () => {
    expect(revoke("missing")).toBe(false);
  });
});

describe("listFor", () => {
  it("returns only the tenant's keys, newest-first", () => {
    mint({ tenantId: "a", label: "first" });
    const { record: r2 } = mint({ tenantId: "a", label: "second" });
    r2.createdAt = Date.now() + 1000;
    mint({ tenantId: "b", label: "other" });
    const aKeys = listFor("a");
    expect(aKeys.length).toBe(2);
    expect(aKeys[0].label).toBe("second");
  });
});
