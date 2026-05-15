/**
 * Tests for src/lib/anon-credential.ts — Cook 136.
 */

import { describe, it, expect } from "vitest";
import {
  anonymizeAuditor,
  issueCredential,
  newGroupSecret,
  rotateGroupSecret,
  verifyCredential,
} from "../anon-credential";

const NOW = 1_700_000_000_000;
const HOUR = 60 * 60 * 1000;

describe("newGroupSecret", () => {
  it("returns 64 hex characters", () => {
    expect(newGroupSecret()).toMatch(/^[0-9a-f]{64}$/);
  });
  it("returns a fresh value each call", () => {
    expect(newGroupSecret()).not.toBe(newGroupSecret());
  });
});

describe("issueCredential", () => {
  const secret = newGroupSecret();

  it("rejects a malformed group secret", () => {
    expect(() =>
      issueCredential({
        groupSecret: "not-hex",
        receiptId: "r1",
        auditorId: "a1",
        expiresAt: NOW + HOUR,
        now: NOW,
      }),
    ).toThrow();
  });

  it("rejects an expired-at-issue token", () => {
    expect(() =>
      issueCredential({
        groupSecret: secret,
        receiptId: "r1",
        auditorId: "a1",
        expiresAt: NOW - 1,
        now: NOW,
      }),
    ).toThrow();
  });

  it("issues a credential with the expected shape", () => {
    const c = issueCredential({
      groupSecret: secret,
      receiptId: "r1",
      auditorId: "a1",
      expiresAt: NOW + HOUR,
      now: NOW,
    });
    expect(c.receiptId).toBe("r1");
    expect(c.auditorId).toBe("a1");
    expect(c.issuedAt).toBe(NOW);
    expect(c.expiresAt).toBe(NOW + HOUR);
    expect(c.nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(c.mac).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different MACs for two issuances even with same inputs (nonce)", () => {
    const a = issueCredential({
      groupSecret: secret,
      receiptId: "r1",
      auditorId: "a1",
      expiresAt: NOW + HOUR,
      now: NOW,
    });
    const b = issueCredential({
      groupSecret: secret,
      receiptId: "r1",
      auditorId: "a1",
      expiresAt: NOW + HOUR,
      now: NOW,
    });
    expect(a.mac).not.toBe(b.mac);
    expect(a.nonce).not.toBe(b.nonce);
  });
});

describe("verifyCredential", () => {
  const secret = newGroupSecret();
  const good = () =>
    issueCredential({
      groupSecret: secret,
      receiptId: "r1",
      auditorId: "a1",
      expiresAt: NOW + HOUR,
      now: NOW,
    });

  it("accepts a fresh, untampered credential", () => {
    const c = good();
    expect(
      verifyCredential({
        groupSecret: secret,
        credential: c,
        receiptId: "r1",
        now: NOW + 1000,
      }),
    ).toEqual({ ok: true });
  });

  it("rejects after expiry", () => {
    const c = good();
    const v = verifyCredential({
      groupSecret: secret,
      credential: c,
      receiptId: "r1",
      now: NOW + 2 * HOUR,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("expired");
  });

  it("rejects a receipt mismatch", () => {
    const c = good();
    const v = verifyCredential({
      groupSecret: secret,
      credential: c,
      receiptId: "DIFFERENT",
      now: NOW + 1000,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("receipt-mismatch");
  });

  it("rejects a tampered MAC", () => {
    const c = good();
    const tampered = {
      ...c,
      mac: c.mac.replace(/.$/, c.mac.endsWith("0") ? "1" : "0"),
    };
    const v = verifyCredential({
      groupSecret: secret,
      credential: tampered,
      receiptId: "r1",
      now: NOW + 1000,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("bad-mac");
  });

  it("rejects a credential signed under a different group secret", () => {
    const c = good();
    const v = verifyCredential({
      groupSecret: newGroupSecret(),
      credential: c,
      receiptId: "r1",
      now: NOW + 1000,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("bad-mac");
  });

  it("rejects tampered auditorId / expiresAt / nonce", () => {
    const c = good();
    for (const field of ["auditorId", "expiresAt", "nonce"] as const) {
      const tampered = {
        ...c,
        [field]: field === "expiresAt" ? c.expiresAt + 1 : "TAMPERED",
      };
      const v = verifyCredential({
        groupSecret: secret,
        credential: tampered,
        receiptId: "r1",
        now: NOW + 1000,
      });
      expect(v.ok).toBe(false);
      if (!v.ok) expect(v.reason).toBe("bad-mac");
    }
  });
});

describe("anonymizeAuditor", () => {
  it("returns a 64-char hex digest", () => {
    expect(anonymizeAuditor("alice@firm.com", "salt-1")).toMatch(
      /^[0-9a-f]{64}$/,
    );
  });
  it("is deterministic for the same inputs", () => {
    expect(anonymizeAuditor("alice@firm.com", "salt-1")).toBe(
      anonymizeAuditor("alice@firm.com", "salt-1"),
    );
  });
  it("changes when salt rotates", () => {
    expect(anonymizeAuditor("alice@firm.com", "salt-1")).not.toBe(
      anonymizeAuditor("alice@firm.com", "salt-2"),
    );
  });
});

describe("rotateGroupSecret", () => {
  it("returns a new secret + a future sunset", () => {
    const r = rotateGroupSecret({ now: NOW });
    expect(r.next).toMatch(/^[0-9a-f]{64}$/);
    expect(r.oldValidUntil).toBeGreaterThan(NOW);
  });
  it("honors caller-supplied sunset window", () => {
    const r = rotateGroupSecret({ now: NOW, sunsetMs: 60_000 });
    expect(r.oldValidUntil).toBe(NOW + 60_000);
  });
});
