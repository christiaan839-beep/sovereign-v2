/**
 * agent-spend — tests.
 *
 * Verifies:
 *   - evaluateCharge: every reject path + happy path
 *   - computeReceiptHash: deterministic, chain-aware
 *   - DB-backed paths fail-OPEN (return null/false) when DB missing
 *   - Tamper-detection: receipt chain is verifiable + breakable
 *
 * The full atomic SELECT FOR UPDATE path is integration-tested,
 * not unit-tested — that requires a real Postgres.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  evaluateCharge,
  computeReceiptHash,
  createAuthorization,
  attemptCharge,
  reverseCharge,
  revokeAuthorization,
  listAuthorizations,
  verifyReceiptChain,
} from "../agent-spend";

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;

beforeEach(() => {
  delete process.env.DATABASE_URL;
});

afterEach(() => {
  if (ORIGINAL_DATABASE_URL !== undefined) {
    process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
  }
  vi.resetModules();
});

const baseAuth = {
  id: "auth_123",
  agentName: "travel-agent",
  maxCents: 5_000,
  spentCents: 0,
  categoryLimits: {} as Record<string, number>,
  allowedMerchants: null as string[] | null,
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  revokedAt: null as Date | null,
  hitlThresholdCents: null as number | null,
};

const baseCharge = {
  agentName: "travel-agent",
  amountCents: 1_000,
  merchantName: "AirlineCo",
  merchantCategory: "travel",
  categorySpent: {} as Record<string, number>,
  now: new Date(),
};

describe("agent-spend — evaluateCharge happy path", () => {
  it("allows a charge under the cap", () => {
    const r = evaluateCharge({ authorization: baseAuth, ...baseCharge });
    expect(r.allowed).toBe(true);
    if (r.allowed) {
      expect(r.remainingCents).toBe(4_000);
      expect(r.hitlRequired).toBe(false);
    }
  });

  it("flags HITL required when over threshold (still allowed)", () => {
    const r = evaluateCharge({
      authorization: { ...baseAuth, hitlThresholdCents: 500 },
      ...baseCharge,
    });
    expect(r.allowed).toBe(true);
    if (r.allowed) {
      expect(r.hitlRequired).toBe(true);
    }
  });
});

describe("agent-spend — evaluateCharge reject paths", () => {
  it("rejects amount <= 0", () => {
    const r = evaluateCharge({
      authorization: baseAuth,
      ...baseCharge,
      amountCents: 0,
    });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe("amount_invalid");
  });

  it("rejects negative amount", () => {
    const r = evaluateCharge({
      authorization: baseAuth,
      ...baseCharge,
      amountCents: -1,
    });
    expect(r.allowed).toBe(false);
  });

  it("rejects non-integer amount", () => {
    const r = evaluateCharge({
      authorization: baseAuth,
      ...baseCharge,
      amountCents: 100.5,
    });
    expect(r.allowed).toBe(false);
  });

  it("rejects when authorization is for a different agent", () => {
    const r = evaluateCharge({
      authorization: { ...baseAuth, agentName: "other-agent" },
      ...baseCharge,
    });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe("agent_mismatch");
  });

  it("rejects when authorization is revoked", () => {
    const r = evaluateCharge({
      authorization: { ...baseAuth, revokedAt: new Date() },
      ...baseCharge,
    });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe("authorization_revoked");
  });

  it("rejects when authorization is expired", () => {
    const r = evaluateCharge({
      authorization: { ...baseAuth, expiresAt: new Date(Date.now() - 1000) },
      ...baseCharge,
    });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe("authorization_expired");
  });

  it("rejects when merchant is not in allowlist", () => {
    const r = evaluateCharge({
      authorization: { ...baseAuth, allowedMerchants: ["AirlineCo", "HotelCo"] },
      ...baseCharge,
      merchantName: "RandomShop",
    });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe("merchant_not_allowed");
  });

  it("ALLOWS when merchant IS in allowlist", () => {
    const r = evaluateCharge({
      authorization: { ...baseAuth, allowedMerchants: ["AirlineCo"] },
      ...baseCharge,
    });
    expect(r.allowed).toBe(true);
  });

  it("rejects when category sub-budget would be exceeded", () => {
    const r = evaluateCharge({
      authorization: {
        ...baseAuth,
        categoryLimits: { travel: 1500 },
      },
      ...baseCharge,
      amountCents: 1000,
      categorySpent: { travel: 800 }, // 800 + 1000 = 1800 > 1500
    });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe("category_limit_exceeded");
  });

  it("ALLOWS when category sub-budget has room", () => {
    const r = evaluateCharge({
      authorization: { ...baseAuth, categoryLimits: { travel: 2000 } },
      ...baseCharge,
      amountCents: 1000,
      categorySpent: { travel: 500 }, // 500 + 1000 = 1500 < 2000
    });
    expect(r.allowed).toBe(true);
  });

  it("ALLOWS when category not in limits map (no sub-budget for this category)", () => {
    const r = evaluateCharge({
      authorization: { ...baseAuth, categoryLimits: { books: 500 } },
      ...baseCharge,
      merchantCategory: "travel", // not in limits — no per-category cap applies
    });
    expect(r.allowed).toBe(true);
  });

  it("rejects when amount exceeds remaining", () => {
    const r = evaluateCharge({
      authorization: { ...baseAuth, spentCents: 4500 },
      ...baseCharge,
      amountCents: 1000, // 4500 + 1000 = 5500 > 5000
    });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe("amount_exceeds_remaining");
  });
});

describe("agent-spend — computeReceiptHash", () => {
  it("is deterministic for same inputs", () => {
    const date = new Date("2026-04-28T12:00:00Z");
    const h1 = computeReceiptHash({
      prevHash: "abc",
      authorizationId: "auth_1",
      idempotencyKey: "k1",
      amountCents: 100,
      merchantName: "Foo",
      merchantCategory: "x",
      createdAt: date,
    });
    const h2 = computeReceiptHash({
      prevHash: "abc",
      authorizationId: "auth_1",
      idempotencyKey: "k1",
      amountCents: 100,
      merchantName: "Foo",
      merchantCategory: "x",
      createdAt: date,
    });
    expect(h1).toBe(h2);
    // SHA-256 hex is 64 chars
    expect(h1).toHaveLength(64);
  });

  it("differs when ANY input changes (chain-detectable tampering)", () => {
    const base = {
      prevHash: "abc",
      authorizationId: "auth_1",
      idempotencyKey: "k1",
      amountCents: 100,
      merchantName: "Foo",
      merchantCategory: "x",
      createdAt: new Date("2026-04-28T12:00:00Z"),
    };
    const baseHash = computeReceiptHash(base);
    expect(computeReceiptHash({ ...base, amountCents: 101 })).not.toBe(baseHash);
    expect(computeReceiptHash({ ...base, merchantName: "Bar" })).not.toBe(baseHash);
    expect(computeReceiptHash({ ...base, prevHash: "xyz" })).not.toBe(baseHash);
    expect(
      computeReceiptHash({ ...base, createdAt: new Date("2026-04-28T12:00:01Z") }),
    ).not.toBe(baseHash);
  });

  it("treats null prevHash as the genesis (chain root)", () => {
    const date = new Date("2026-04-28T12:00:00Z");
    const genesis = computeReceiptHash({
      prevHash: null,
      authorizationId: "auth_1",
      idempotencyKey: "k1",
      amountCents: 100,
      merchantName: "Foo",
      merchantCategory: "x",
      createdAt: date,
    });
    // A chain that uses "GENESIS" as the literal prevHash should match.
    const alt = computeReceiptHash({
      prevHash: "GENESIS",
      authorizationId: "auth_1",
      idempotencyKey: "k1",
      amountCents: 100,
      merchantName: "Foo",
      merchantCategory: "x",
      createdAt: date,
    });
    expect(genesis).toBe(alt);
  });
});

describe("agent-spend — DB-backed fail-open behavior", () => {
  it("createAuthorization returns db_unavailable when DB missing", async () => {
    const r = await createAuthorization({
      userId: "u",
      agentName: "a",
      maxCents: 100,
      expiresInHours: 1,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("db_unavailable");
  });

  it("createAuthorization rejects invalid maxCents", async () => {
    const r = await createAuthorization({
      userId: "u",
      agentName: "a",
      maxCents: 0,
      expiresInHours: 1,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_input");
  });

  it("createAuthorization rejects insanely long expiry", async () => {
    const r = await createAuthorization({
      userId: "u",
      agentName: "a",
      maxCents: 100,
      expiresInHours: 999_999,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("invalid_input");
  });

  it("attemptCharge returns db_unavailable when DB missing", async () => {
    const r = await attemptCharge({
      authorizationId: "00000000-0000-0000-0000-000000000000",
      agentName: "a",
      idempotencyKey: "k_" + Date.now(),
      amountCents: 100,
      merchantName: "Foo",
      merchantCategory: "x",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("db_unavailable");
  });

  it("attemptCharge rejects amount <= 0 even before DB", async () => {
    const r = await attemptCharge({
      authorizationId: "00000000-0000-0000-0000-000000000000",
      agentName: "a",
      idempotencyKey: "k_" + Date.now(),
      amountCents: 0,
      merchantName: "Foo",
      merchantCategory: "x",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("amount_invalid");
  });

  it("reverseCharge returns db_unavailable when DB missing", async () => {
    const r = await reverseCharge({
      chargeId: "c1",
      reason: "user changed mind",
      actor: "u",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("db_unavailable");
  });

  it("revokeAuthorization is fail-soft when DB missing", async () => {
    const r = await revokeAuthorization({
      authorizationId: "auth_1",
      userId: "u",
    });
    expect(r.ok).toBe(false);
  });

  it("listAuthorizations returns empty array when DB missing", async () => {
    const r = await listAuthorizations("u");
    expect(r).toEqual([]);
  });

  it("verifyReceiptChain fail-opens to ok:true when DB missing", async () => {
    const r = await verifyReceiptChain("auth_1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.chargeCount).toBe(0);
  });
});
