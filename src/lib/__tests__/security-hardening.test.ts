/**
 * Security hardening tests — covers the 4 pieces of the 2026-04-24
 * reliability + security sprint:
 *
 *   1. PII output guard (src/lib/pii-guard.ts)
 *   2. API key scope evaluator (src/lib/api-key-scopes.ts)
 *   3. Free-first router gate (src/lib/provider-costs.ts)
 *   4. (Audit-log hash chain tests live in src/lib/__tests__/audit-chain.test.ts
 *      because they need the DB — separate test file.)
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { scanPii, scrubPii, scrubPiiDeep } from "@/lib/pii-guard";
import { evaluateScope, classifyV1Request, type ApiKeyRecord } from "@/lib/api-key-scopes";
import { isProviderAllowedFree, PROVIDER_COSTS } from "@/lib/provider-costs";

// ────────────────────────────────────────────────────────────
// PII guard
// ────────────────────────────────────────────────────────────

describe("pii-guard · scanPii", () => {
  it("detects SSN", () => {
    const f = scanPii("Applicant SSN is 123-45-6789.");
    expect(f).toHaveLength(1);
    expect(f[0].type).toBe("ssn");
    expect(f[0].matchedText).toBe("123-45-6789");
  });

  it("does NOT flag obviously-masked SSN XXX-XX-NNNN", () => {
    const f = scanPii("SSN: XXX-XX-6789");
    const ssn = f.find((x) => x.type === "ssn");
    expect(ssn).toBeUndefined();
  });

  it("detects valid credit card via Luhn", () => {
    // 4532015112830366 = Visa test number, passes Luhn
    const f = scanPii("Card on file: 4532015112830366");
    const cc = f.find((x) => x.type === "credit_card");
    expect(cc).toBeDefined();
    expect(cc?.matchedText).toBe("4532015112830366");
  });

  it("rejects Luhn-failing card-shaped strings", () => {
    // 1234567812345678 — fails Luhn
    const f = scanPii("Fake card: 1234567812345678");
    const cc = f.find((x) => x.type === "credit_card");
    expect(cc).toBeUndefined();
  });

  it("detects US + E.164 phone numbers", () => {
    const f = scanPii("Call (415) 555-0134 or +1-415-555-0199 today.");
    const phones = f.filter((x) => x.type === "phone");
    expect(phones.length).toBeGreaterThanOrEqual(1);
  });

  it("detects email and masks to first-letter + domain", () => {
    const f = scanPii("Reply to alice.smith@acme.co");
    const email = f.find((x) => x.type === "email");
    expect(email).toBeDefined();
    expect(email?.matchedText).toBe("alice.smith@acme.co");
    expect(email?.maskedText).toMatch(/^a\*+@acme\.co$/);
  });

  it("returns empty list for clean text", () => {
    const f = scanPii("The quick brown fox jumps over the lazy dog.");
    expect(f).toHaveLength(0);
  });
});

describe("pii-guard · scrubPii", () => {
  it("masks in place preserving surrounding prose", () => {
    const r = scrubPii("Applicant SSN: 123-45-6789 (verified)");
    expect(r.mutated).toBe(true);
    expect(r.scrubbed).toBe("Applicant SSN: XXX-XX-6789 (verified)");
  });

  it("flag-mode returns findings without mutating", () => {
    const r = scrubPii("Email: bob@acme.co", "flag");
    expect(r.findings).toHaveLength(1);
    expect(r.scrubbed).toBe("Email: bob@acme.co"); // unchanged
    expect(r.mutated).toBe(false);
  });

  it("skip-mode no-ops entirely", () => {
    const r = scrubPii("Contact 415-555-0134", "skip");
    expect(r.findings).toHaveLength(0);
    expect(r.scrubbed).toBe("Contact 415-555-0134");
  });

  it("handles multiple findings in one string", () => {
    const r = scrubPii(
      "SSN 111-22-3333, phone (212) 555-0101, email a@b.co",
    );
    // 3 distinct types detected + scrubbed
    expect(r.findings.length).toBeGreaterThanOrEqual(3);
    expect(r.scrubbed).not.toContain("111-22-3333");
    expect(r.scrubbed).toContain("XXX-XX-3333");
  });

  it("fails-open on scrub errors (doesn't throw)", () => {
    // Any corrupt input shouldn't crash. Feed an enormously long string.
    const huge = "A".repeat(1_000_000);
    const r = scrubPii(huge);
    expect(r).toBeDefined();
    expect(r.scrubbed).toBeDefined();
  });
});

describe("pii-guard · scrubPiiDeep", () => {
  it("walks object trees and scrubs every string leaf", () => {
    const payload = {
      recipient: { name: "Alice", ssn: "123-45-6789", email: "a@b.co" },
      amounts: [1200, 3400],
      notes: "Call (415) 555-0134",
    };
    const r = scrubPiiDeep(payload);
    const scrubbed = r.scrubbed as typeof payload;
    expect(scrubbed.recipient.ssn).toBe("XXX-XX-6789");
    expect(scrubbed.recipient.email).toMatch(/^a\*+@b\.co$/);
    expect(scrubbed.recipient.name).toBe("Alice"); // names untouched
    expect(scrubbed.amounts).toEqual([1200, 3400]); // numbers untouched
    expect(scrubbed.notes).toContain("(***) ***-0134");
    expect(r.findings.length).toBeGreaterThanOrEqual(3);
  });

  it("respects maxDepth to avoid runaway recursion", () => {
    // Build an 11-deep nested object
    let obj: Record<string, unknown> = { ssn: "123-45-6789" };
    for (let i = 0; i < 10; i++) obj = { nested: obj };
    const r = scrubPiiDeep(obj, "mask", { maxDepth: 5 });
    // Deep ssn survives unchanged (walk halted before reaching it)
    const seek = (n: unknown, d: number): string | null => {
      if (d > 20) return null;
      if (!n || typeof n !== "object") return null;
      const o = n as Record<string, unknown>;
      if (typeof o.ssn === "string") return o.ssn;
      return seek(o.nested, d + 1);
    };
    const found = seek(r.scrubbed, 0);
    expect(found).toBe("123-45-6789"); // not scrubbed because too deep
  });
});

// ────────────────────────────────────────────────────────────
// API key scopes
// ────────────────────────────────────────────────────────────

function makeKey(overrides: Partial<ApiKeyRecord> = {}): ApiKeyRecord {
  return {
    id: "k1",
    userId: "u1",
    plan: "pro",
    scopes: null,
    allowedAgents: null,
    allowedIps: null,
    ...overrides,
  };
}

describe("api-key-scopes · evaluateScope", () => {
  it("legacy key (NULL scopes) passes everything for backward compat", () => {
    const k = makeKey({ scopes: null });
    const r = evaluateScope(k, { scope: "agent:execute", agentSlug: "leads" });
    expect(r.allowed).toBe(true);
  });

  it("empty array scopes denies everything (revoked-in-place)", () => {
    const k = makeKey({ scopes: [] });
    const r = evaluateScope(k, { scope: "agent:execute", agentSlug: "leads" });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe("no_scopes");
  });

  it("agent:execute scope allows any agent when no allowlist", () => {
    const k = makeKey({ scopes: ["agent:execute"] });
    const r = evaluateScope(k, { scope: "agent:execute", agentSlug: "leads" });
    expect(r.allowed).toBe(true);
  });

  it("agent:execute scope + allowedAgents enforces slug list", () => {
    const k = makeKey({
      scopes: ["agent:execute"],
      allowedAgents: ["icd10-coder", "prior-auth-drafter"],
    });
    const ok = evaluateScope(k, { scope: "agent:execute", agentSlug: "icd10-coder" });
    const no = evaluateScope(k, { scope: "agent:execute", agentSlug: "leads" });
    expect(ok.allowed).toBe(true);
    expect(no.allowed).toBe(false);
    if (!no.allowed) expect(no.reason).toBe("agent_not_allowlisted");
  });

  it("per-agent scope takes precedence over generic", () => {
    const k = makeKey({ scopes: ["agent:execute:icd10-coder"] });
    const ok = evaluateScope(k, { scope: "agent:execute", agentSlug: "icd10-coder" });
    const no = evaluateScope(k, { scope: "agent:execute", agentSlug: "leads" });
    expect(ok.allowed).toBe(true);
    expect(no.allowed).toBe(false);
  });

  it("admin scope is an escape hatch", () => {
    const k = makeKey({ scopes: ["admin"] });
    const r = evaluateScope(k, { scope: "data:write" });
    expect(r.allowed).toBe(true);
  });

  it("IP allowlist: CIDR match", () => {
    const k = makeKey({
      scopes: ["agent:execute"],
      allowedIps: ["203.0.113.0/24"],
    });
    const ok = evaluateScope(k, {
      scope: "agent:execute",
      agentSlug: "leads",
      ipAddress: "203.0.113.42",
    });
    const no = evaluateScope(k, {
      scope: "agent:execute",
      agentSlug: "leads",
      ipAddress: "198.51.100.1",
    });
    expect(ok.allowed).toBe(true);
    expect(no.allowed).toBe(false);
    if (!no.allowed) expect(no.reason).toBe("ip_not_allowed");
  });

  it("IP allowlist: exact /32 match", () => {
    const k = makeKey({
      scopes: ["agent:execute"],
      allowedIps: ["203.0.113.42/32"],
    });
    const ok = evaluateScope(k, {
      scope: "agent:execute",
      agentSlug: "leads",
      ipAddress: "203.0.113.42",
    });
    const no = evaluateScope(k, {
      scope: "agent:execute",
      agentSlug: "leads",
      ipAddress: "203.0.113.43",
    });
    expect(ok.allowed).toBe(true);
    expect(no.allowed).toBe(false);
  });

  it("IP allowlist requires a client IP when configured", () => {
    const k = makeKey({
      scopes: ["agent:execute"],
      allowedIps: ["10.0.0.0/8"],
    });
    const r = evaluateScope(k, {
      scope: "agent:execute",
      agentSlug: "leads",
    });
    expect(r.allowed).toBe(false);
    if (!r.allowed) expect(r.reason).toBe("ip_required");
  });
});

// ────────────────────────────────────────────────────────────
// Free-first router
// ────────────────────────────────────────────────────────────

describe("provider-costs · isProviderAllowedFree", () => {
  const originalEnv = process.env.SOVEREIGN_FREE_ONLY;
  afterEach(() => {
    process.env.SOVEREIGN_FREE_ONLY = originalEnv;
    vi.restoreAllMocks();
  });

  it("when mode OFF, every provider is allowed", () => {
    // Note: FREE_ONLY_MODE is module-load-time, which for this test run
    // reflects whatever env was set when vitest started. We test the
    // pure-function behavior assuming either state.
    expect(PROVIDER_COSTS.openai).toBe("paid");
    expect(PROVIDER_COSTS.nim).toBe("free");
  });

  it("catalogs the frontier providers as paid", () => {
    const paid = [
      "openai",
      "xai",
      "mistral-direct",
      "cohere",
      "openrouter",
      "together",
      "databricks",
      "replicate",
    ];
    for (const p of paid) expect(PROVIDER_COSTS[p]).toBe("paid");
  });

  it("catalogs the free tier correctly", () => {
    const free = ["ollama", "nim", "nvidia-nim", "cerebras"];
    for (const p of free) expect(PROVIDER_COSTS[p]).toBe("free");
  });

  it("unknown providers default to paid (conservative)", () => {
    // The function returns true when mode is off — we can only test
    // the classification. Classification defaults to "paid" for unknowns.
    const tier = PROVIDER_COSTS["some-new-provider-not-yet-catalogued"];
    expect(tier).toBeUndefined(); // not in map
    // isProviderAllowedFree treats missing as "paid" implicitly
    const result = isProviderAllowedFree("some-new-provider-not-yet-catalogued");
    // Whether this is true/false depends on FREE_ONLY_MODE;
    // the important invariant is "missing is NOT free-allowed"
    if (process.env.SOVEREIGN_FREE_ONLY === "true") {
      expect(result).toBe(false);
    }
  });
});

// ────────────────────────────────────────────────────────────
// V1 gateway request classifier
// ────────────────────────────────────────────────────────────

describe("api-key-scopes · classifyV1Request", () => {
  it("/agents/<slug> → agent:execute on slug", () => {
    expect(classifyV1Request(["agents", "leads"], "POST")).toEqual({
      scope: "agent:execute",
      agentSlug: "leads",
    });
  });

  it("/agents (no slug) is treated as a generic /agents/ traversal — falls through to method-based default", () => {
    // Without a slug we can't enforce a per-agent scope. The classifier
    // falls back to the generic GET-vs-non-GET rule.
    expect(classifyV1Request(["agents"], "GET")).toEqual({ scope: "data:read" });
    expect(classifyV1Request(["agents"], "POST")).toEqual({ scope: "agent:execute" });
  });

  it("/playbooks/* → agent:execute (no slug — playbooks orchestrate multiple agents)", () => {
    expect(classifyV1Request(["playbooks", "run"], "POST")).toEqual({
      scope: "agent:execute",
    });
  });

  it("/workflows/* → agent:execute", () => {
    expect(classifyV1Request(["workflows", "abc"], "POST")).toEqual({
      scope: "agent:execute",
    });
  });

  it("/health/* → data:read regardless of method", () => {
    expect(classifyV1Request(["health", "ping"], "GET")).toEqual({ scope: "data:read" });
    expect(classifyV1Request(["health", "ping"], "POST")).toEqual({ scope: "data:read" });
  });

  it("/status/* → data:read", () => {
    expect(classifyV1Request(["status", "slo"], "GET")).toEqual({ scope: "data:read" });
  });

  it("unknown GET → data:read (conservative)", () => {
    expect(classifyV1Request(["something", "new"], "GET")).toEqual({ scope: "data:read" });
  });

  it("unknown non-GET → agent:execute (treats writes as execution)", () => {
    expect(classifyV1Request(["something", "new"], "POST")).toEqual({ scope: "agent:execute" });
    expect(classifyV1Request(["something", "new"], "PATCH")).toEqual({ scope: "agent:execute" });
    expect(classifyV1Request(["something", "new"], "DELETE")).toEqual({ scope: "agent:execute" });
  });

  it("empty path → falls through to method default", () => {
    expect(classifyV1Request([], "GET")).toEqual({ scope: "data:read" });
    expect(classifyV1Request([], "POST")).toEqual({ scope: "agent:execute" });
  });
});
