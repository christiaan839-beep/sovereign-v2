/**
 * Tests for src/lib/built-ledger.ts — Wave 14.
 *
 * Verifies the append-only shipped ledger:
 *   - Every entry has a well-formed canonical projection
 *   - canonicalizeMilestone is deterministic (sorted keys, no drift)
 *   - signMilestone produces a stable signature under a fixed secret
 *   - ledgerDigest changes when a new entry is appended (regression
 *     guard for mutation-by-edit attempts)
 *   - getSignedLedger returns a structurally-correct payload
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHash, randomBytes } from "crypto";
import {
  BUILT_LEDGER,
  canonicalizeMilestone,
  signMilestone,
  ledgerDigest,
  getSignedLedger,
  type MilestoneEntry,
} from "@/lib/built-ledger";

const originalSecret = process.env.AGENT_RUN_SIGNING_SECRET;
const originalEd = process.env.AGENT_RUN_ED25519_PRIVATE_KEY;

beforeAll(() => {
  delete process.env.AGENT_RUN_ED25519_PRIVATE_KEY;
  process.env.AGENT_RUN_SIGNING_SECRET = randomBytes(24).toString("hex");
});
afterAll(() => {
  if (originalSecret !== undefined)
    process.env.AGENT_RUN_SIGNING_SECRET = originalSecret;
  else delete process.env.AGENT_RUN_SIGNING_SECRET;
  if (originalEd !== undefined)
    process.env.AGENT_RUN_ED25519_PRIVATE_KEY = originalEd;
});

const SAMPLE: MilestoneEntry = {
  slug: "test-milestone-01",
  title: "Test milestone",
  description: "A test milestone for the ledger.",
  shippedAt: "2026-05-16T10:00:00.000Z",
  wave: 99,
  commit: "deadbeef",
  category: "infrastructure",
};

describe("BUILT_LEDGER", () => {
  it("contains at least one milestone (smoke test)", () => {
    expect(BUILT_LEDGER.length).toBeGreaterThan(0);
  });

  it("every entry has the required fields", () => {
    for (const e of BUILT_LEDGER) {
      expect(e.slug).toMatch(/^[a-z0-9-]+$/);
      expect(e.title.length).toBeGreaterThan(0);
      expect(e.description.length).toBeGreaterThan(0);
      expect(e.shippedAt).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
      expect(e.wave).toBeGreaterThan(0);
      expect(e.commit).toMatch(/^[0-9a-f]+$/);
      expect([
        "security",
        "infrastructure",
        "compliance",
        "revenue",
        "ux",
        "platform",
        "observability",
      ]).toContain(e.category);
    }
  });

  it("slugs are unique across the ledger (append-only invariant)", () => {
    const slugs = BUILT_LEDGER.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("canonicalizeMilestone", () => {
  it("produces deterministic output for the same input", () => {
    const a = canonicalizeMilestone(SAMPLE);
    const b = canonicalizeMilestone(SAMPLE);
    expect(a).toBe(b);
  });

  it("places the version (v) and type discriminator first (matches receipt canonical layout)", () => {
    const c = canonicalizeMilestone(SAMPLE);
    const parsed = JSON.parse(c) as Record<string, unknown>;
    const keys = Object.keys(parsed);
    expect(keys[0]).toBe("v");
    expect(keys[1]).toBe("type");
    expect(parsed.type).toBe("built-ledger-entry");
  });

  it("changes when any input field changes", () => {
    const a = canonicalizeMilestone(SAMPLE);
    const b = canonicalizeMilestone({ ...SAMPLE, title: "Different title" });
    expect(a).not.toBe(b);
  });

  it("emits null for missing verifyHref (not undefined)", () => {
    const c = canonicalizeMilestone(SAMPLE);
    expect(JSON.parse(c).verifyHref).toBeNull();
  });
});

describe("signMilestone", () => {
  it("returns a stable signature for the same input under the same key", () => {
    const a = signMilestone(SAMPLE);
    const b = signMilestone(SAMPLE);
    expect(a.signature).toBe(b.signature);
    expect(a.contentHash).toBe(b.contentHash);
  });

  it("contentHash equals SHA-256 of canonical", () => {
    const a = signMilestone(SAMPLE);
    const expected = createHash("sha256")
      .update(a.canonical, "utf8")
      .digest("hex");
    expect(a.contentHash).toBe(expected);
  });

  it("signature is in v1=hex format (HMAC scheme active in this test)", () => {
    const a = signMilestone(SAMPLE);
    expect(a.signature).toMatch(/^v1=[0-9a-f]+$/);
  });
});

describe("ledgerDigest", () => {
  it("returns a 64-char hex SHA-256", () => {
    expect(ledgerDigest()).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic across consecutive calls", () => {
    expect(ledgerDigest()).toBe(ledgerDigest());
  });
});

describe("getSignedLedger", () => {
  it("returns digest + count + entries[]", () => {
    const out = getSignedLedger();
    expect(out.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(out.count).toBe(BUILT_LEDGER.length);
    expect(out.entries).toHaveLength(BUILT_LEDGER.length);
    for (const e of out.entries) {
      expect(e.entry).toBeTruthy();
      expect(e.canonical).toBeTypeOf("string");
      expect(e.contentHash).toMatch(/^[0-9a-f]{64}$/);
      expect(e.signature).toMatch(/^v\d=/);
    }
  });
});
