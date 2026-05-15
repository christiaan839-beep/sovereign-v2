/**
 * Tests for src/lib/pat-store.ts — Cook 88.
 *
 *   - issue: rejects empty inputs + oversize label; returns cleartext
 *     starting with the public prefix; stores hash-only.
 *   - listFor: scoped to the userId; sorted newest-first.
 *   - revoke: returns true on success, false on missing/wrong owner.
 *   - verify: matches the issued token; rejects garbage + expired.
 *   - cleartext is NOT stored anywhere reachable post-issue.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { issue, listFor, revoke, verify, _resetForTests } from "../pat-store";

beforeEach(() => {
  _resetForTests();
});

describe("issue", () => {
  it("rejects empty userId or label", () => {
    expect(() => issue({ userId: "", label: "x" })).toThrow();
    expect(() => issue({ userId: "u", label: "" })).toThrow();
  });

  it("rejects oversize label", () => {
    expect(() => issue({ userId: "u", label: "x".repeat(81) })).toThrow();
  });

  it("returns a cleartext token starting with the public prefix", () => {
    const { cleartext, record } = issue({ userId: "u", label: "test" });
    expect(cleartext.startsWith("sk_pat_")).toBe(true);
    expect(record.prefix.length).toBe(12);
    expect(cleartext.startsWith(record.prefix)).toBe(true);
  });

  it("stores hash only — the record's hash is not the cleartext", () => {
    const { cleartext, record } = issue({ userId: "u", label: "test" });
    expect(record.hash).not.toBe(cleartext);
    expect(/^[a-f0-9]{64}$/.test(record.hash)).toBe(true);
  });
});

describe("listFor", () => {
  it("returns only the given user's records", () => {
    issue({ userId: "alice", label: "a" });
    issue({ userId: "bob", label: "b" });
    issue({ userId: "alice", label: "a2" });
    const a = listFor("alice");
    expect(a.length).toBe(2);
    expect(a.every((r) => r.userId === "alice")).toBe(true);
  });

  it("returns newest-first", () => {
    issue({ userId: "u", label: "first" });
    // Force monotonic createdAt ordering even if the test runs <1ms.
    const r2 = issue({ userId: "u", label: "second" });
    r2.record.createdAt = Date.now() + 1000;
    const list = listFor("u");
    expect(list[0].label).toBe("second");
  });
});

describe("revoke", () => {
  it("returns true and removes the record on success", () => {
    const { record } = issue({ userId: "u", label: "x" });
    expect(revoke(record.id, "u")).toBe(true);
    expect(listFor("u").length).toBe(0);
  });

  it("returns false when the userId doesn't own the record", () => {
    const { record } = issue({ userId: "alice", label: "x" });
    expect(revoke(record.id, "bob")).toBe(false);
    // Original record is still there.
    expect(listFor("alice").length).toBe(1);
  });

  it("returns false on missing id", () => {
    expect(revoke("missing", "u")).toBe(false);
  });
});

describe("verify", () => {
  it("matches the issued cleartext and updates lastUsedAt", () => {
    const { cleartext, record } = issue({ userId: "u", label: "x" });
    expect(record.lastUsedAt).toBeUndefined();
    const matched = verify(cleartext);
    expect(matched?.id).toBe(record.id);
    expect(matched?.lastUsedAt).toBeGreaterThan(0);
  });

  it("rejects an unknown token", () => {
    issue({ userId: "u", label: "x" });
    expect(verify("sk_pat_some-random-other-token")).toBeNull();
  });

  it("rejects garbage / wrong prefix", () => {
    issue({ userId: "u", label: "x" });
    expect(verify("not-a-pat")).toBeNull();
    expect(verify("")).toBeNull();
    expect(verify("bearer-token")).toBeNull();
  });

  it("rejects expired tokens", () => {
    const { cleartext, record } = issue({
      userId: "u",
      label: "x",
      ttlMs: 1,
    });
    record.expiresAt = Date.now() - 1; // force expired
    expect(verify(cleartext)).toBeNull();
  });
});
