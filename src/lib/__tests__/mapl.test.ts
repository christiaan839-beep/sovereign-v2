/**
 * Wave 113 — MAPL composition algebra contract tests.
 *
 * These tests are NOT "does the code work" tests — they are
 * ALGEBRAIC-LAW PROOFS. Every law that justifies the
 * monotonic-restriction + transitive-denial axioms is verified here
 * against a representative sample of policies and actions. If any
 * test fails, the algebra has been broken structurally and downstream
 * authentication / authorization guarantees no longer hold.
 *
 * Laws under test:
 *   L1.  identity:        compose(p, TOP) ≡ p
 *   L2.  bottom:          compose(p, BOTTOM) denies all
 *   L3.  idempotence:     compose(p, p) ≡ p
 *   L4.  commutativity:   compose(p1, p2) ≡ compose(p2, p1)
 *   L5.  associativity:   compose(compose(p1, p2), p3) ≡ compose(p1, compose(p2, p3))
 *   L6.  monotonic restriction: allowed(compose(p1, p2)) ⊆ allowed(p1)
 *   L7.  transitive denial: denied(p_i) ⇒ denied(compose(...p_i...))
 *   L8.  closed-world default: no allow rule matching ⇒ denied
 *   L9.  constraint most-restrictive: composed cap ≤ min(input caps)
 *   L10. glob matcher: `**` spans dots, `*` does not
 */
import { describe, it, expect } from "vitest";
import {
  TOP,
  BOTTOM,
  compose,
  composeAll,
  evaluate,
  matchGlob,
  mostRestrictive,
  policy,
  fromLegacyPolicy,
  type MaplPolicy,
} from "@/lib/mapl";

// ─── Test policies ──

const P_API = policy({
  id: "api-only",
  allow: ["api.*"],
  deny: ["api.admin.*"],
});

const P_DB = policy({
  id: "db-readonly",
  allow: ["db.read.*", "api.read.*"],
  deny: ["db.write.*", "db.drop.*"],
});

const P_OWNER = policy({
  id: "owner",
  allow: ["**"],
  deny: ["payment.refund.*"],
});

// ── Action set used to compare equivalence between two policies ──
const ACTION_SAMPLE = [
  "api.read.leads",
  "api.write.leads",
  "api.admin.users",
  "db.read.tenants",
  "db.write.tenants",
  "db.drop.tenants",
  "payment.refund.processed",
  "payment.charge.created",
  "tool.competitor-scan",
  "agent.execute",
  "", // boundary
  "..", // boundary
];

/** Two policies are EQUIVALENT when they produce the same allow/deny verdict for every action in the sample. */
function equivalent(p1: MaplPolicy, p2: MaplPolicy): boolean {
  for (const a of ACTION_SAMPLE) {
    if (evaluate(p1, a).allowed !== evaluate(p2, a).allowed) return false;
  }
  return true;
}

// ─── L1. Identity ──────────────────────────────────────────────────────────

describe("mapl — L1 identity (compose(p, TOP) ≡ p)", () => {
  it("compose(P_API, TOP) is equivalent to P_API for every sampled action", () => {
    expect(equivalent(compose(P_API, TOP), P_API)).toBe(true);
  });
  it("compose(TOP, P_API) is equivalent to P_API (works on left too)", () => {
    expect(equivalent(compose(TOP, P_API), P_API)).toBe(true);
  });
  it("composeAll() with zero args returns the identity element TOP", () => {
    const id = composeAll();
    expect(evaluate(id, "anything").allowed).toBe(true);
  });
});

// ─── L2. Bottom ────────────────────────────────────────────────────────────

describe("mapl — L2 bottom (compose(p, BOTTOM) denies all)", () => {
  it("BOTTOM alone denies everything", () => {
    for (const a of ACTION_SAMPLE) {
      expect(evaluate(BOTTOM, a).allowed).toBe(false);
    }
  });
  it("compose(P_OWNER, BOTTOM) denies everything (BOTTOM wins via transitive denial)", () => {
    const locked = compose(P_OWNER, BOTTOM);
    for (const a of ACTION_SAMPLE) {
      expect(evaluate(locked, a).allowed).toBe(false);
    }
  });
});

// ─── L3. Idempotence ───────────────────────────────────────────────────────

describe("mapl — L3 idempotence (compose(p, p) ≡ p)", () => {
  it("compose(P_API, P_API) equivalent to P_API", () => {
    expect(equivalent(compose(P_API, P_API), P_API)).toBe(true);
  });
  it("compose(P_DB, P_DB) equivalent to P_DB", () => {
    expect(equivalent(compose(P_DB, P_DB), P_DB)).toBe(true);
  });
});

// ─── L4. Commutativity ─────────────────────────────────────────────────────

describe("mapl — L4 commutativity (order does not change verdicts)", () => {
  it("compose(P_API, P_DB) equivalent to compose(P_DB, P_API)", () => {
    expect(equivalent(compose(P_API, P_DB), compose(P_DB, P_API))).toBe(true);
  });
  it("compose(P_OWNER, P_API) equivalent to compose(P_API, P_OWNER)", () => {
    expect(equivalent(compose(P_OWNER, P_API), compose(P_API, P_OWNER))).toBe(
      true,
    );
  });
});

// ─── L5. Associativity ─────────────────────────────────────────────────────

describe("mapl — L5 associativity (grouping does not matter)", () => {
  it("compose(compose(p1, p2), p3) ≡ compose(p1, compose(p2, p3))", () => {
    const left = compose(compose(P_API, P_DB), P_OWNER);
    const right = compose(P_API, compose(P_DB, P_OWNER));
    expect(equivalent(left, right)).toBe(true);
  });
  it("composeAll(p1, p2, p3) is equivalent to a left fold of compose", () => {
    const folded = composeAll(P_API, P_DB, P_OWNER);
    const left = compose(compose(P_API, P_DB), P_OWNER);
    expect(equivalent(folded, left)).toBe(true);
  });
});

// ─── L6. Monotonic restriction ─────────────────────────────────────────────

describe("mapl — L6 monotonic restriction (composition never expands permissions)", () => {
  it("every action allowed by compose(P_API, P_DB) is also allowed by P_API", () => {
    const composed = compose(P_API, P_DB);
    for (const a of ACTION_SAMPLE) {
      if (evaluate(composed, a).allowed) {
        expect(evaluate(P_API, a).allowed).toBe(true);
      }
    }
  });
  it("every action allowed by compose(P_API, P_DB) is also allowed by P_DB", () => {
    const composed = compose(P_API, P_DB);
    for (const a of ACTION_SAMPLE) {
      if (evaluate(composed, a).allowed) {
        expect(evaluate(P_DB, a).allowed).toBe(true);
      }
    }
  });
});

// ─── L7. Transitive denial ────────────────────────────────────────────────

describe("mapl — L7 transitive denial (one denial poisons the composition)", () => {
  it("P_API denies api.admin.users; compose(P_API, P_OWNER) also denies it", () => {
    expect(evaluate(P_API, "api.admin.users").allowed).toBe(false);
    expect(evaluate(compose(P_API, P_OWNER), "api.admin.users").allowed).toBe(
      false,
    );
  });
  it("P_OWNER denies payment.refund.processed; composition with anything still denies it", () => {
    expect(
      evaluate(composeAll(P_OWNER, P_API, P_DB), "payment.refund.processed")
        .allowed,
    ).toBe(false);
  });
});

// ─── L8. Closed-world default ──────────────────────────────────────────────

describe("mapl — L8 closed-world default (no allow rule ⇒ denied)", () => {
  it("an action not covered by P_API.allow returns denied", () => {
    const v = evaluate(P_API, "totally.unknown.action");
    expect(v.allowed).toBe(false);
    expect(v.reason).toContain("no allow rule matched");
  });
  it("empty policy denies everything", () => {
    const empty = policy({ id: "empty" });
    for (const a of ACTION_SAMPLE) {
      expect(evaluate(empty, a).allowed).toBe(false);
    }
  });
});

// ─── L9. Constraint most-restrictive ───────────────────────────────────────

describe("mapl — L9 constraint most-restrictive", () => {
  it("composed maxTokensPerCall is the min of inputs", () => {
    expect(
      mostRestrictive({ maxTokensPerCall: 4000 }, { maxTokensPerCall: 1000 })
        ?.maxTokensPerCall,
    ).toBe(1000);
  });
  it("composed maxCallsPerHour is the min of inputs", () => {
    expect(
      mostRestrictive({ maxCallsPerHour: 60 }, { maxCallsPerHour: 10 })
        ?.maxCallsPerHour,
    ).toBe(10);
  });
  it("requireApproval is OR (any true wins)", () => {
    expect(
      mostRestrictive({ requireApproval: false }, { requireApproval: true })
        ?.requireApproval,
    ).toBe(true);
  });
  it("allowedHours is the intersection of windows", () => {
    const c = mostRestrictive(
      { allowedHours: { start: 9, end: 17 } },
      { allowedHours: { start: 13, end: 22 } },
    );
    expect(c?.allowedHours).toEqual({ start: 13, end: 17 });
  });
  it("disjoint allowedHours produce an empty (start > end) window", () => {
    const c = mostRestrictive(
      { allowedHours: { start: 9, end: 12 } },
      { allowedHours: { start: 14, end: 18 } },
    );
    expect(c?.allowedHours!.start).toBeGreaterThan(c?.allowedHours!.end);
  });
  it("composed policy exposes its effective constraints via evaluate()", () => {
    const a = policy({
      id: "a",
      allow: ["*"],
      constraints: { maxTokensPerCall: 4000, requireApproval: false },
    });
    const b = policy({
      id: "b",
      allow: ["*"],
      constraints: { maxTokensPerCall: 1000, requireApproval: true },
    });
    const v = evaluate(compose(a, b), "anything");
    expect(v.constraints?.maxTokensPerCall).toBe(1000);
    expect(v.constraints?.requireApproval).toBe(true);
  });
});

// ─── L10. Glob matcher ────────────────────────────────────────────────────

describe("mapl — L10 glob matcher", () => {
  it("`**` spans dot boundaries", () => {
    expect(matchGlob("**", "a.b.c")).toBe(true);
    expect(matchGlob("api.**", "api.read.leads")).toBe(true);
  });
  it("`*` does NOT span dot boundaries (single-segment match)", () => {
    expect(matchGlob("api.*", "api.read.leads")).toBe(false);
    expect(matchGlob("api.*", "api.read")).toBe(true);
  });
  it("escapes regex metacharacters defensively", () => {
    expect(matchGlob("safe(", "safe(")).toBe(true);
    expect(matchGlob("a+b", "a+b")).toBe(true);
    expect(matchGlob("[bracket]", "[bracket]")).toBe(true);
  });
  it("returns false for non-string inputs (defensive)", () => {
    // @ts-expect-error: deliberate type abuse for runtime test
    expect(matchGlob(null, "anything")).toBe(false);
    // @ts-expect-error: deliberate type abuse for runtime test
    expect(matchGlob("api.*", undefined)).toBe(false);
  });
});

// ─── Legacy adapter ────────────────────────────────────────────────────────

describe("mapl — fromLegacyPolicy adapter", () => {
  it("lifts a legacy Policy.rules array into MaplPolicy allow/deny sets", () => {
    const lifted = fromLegacyPolicy({
      id: "legacy-test",
      rules: [
        { action: "db.read", effect: "allow" },
        { action: "db.drop", effect: "deny", reason: "schema is locked" },
        { action: "email.send_bulk", effect: "warn" },
      ],
    });
    expect(lifted.id).toBe("legacy-test");
    expect(lifted.allow.map((r) => r.pattern)).toContain("db.read");
    // "warn" lifts to allow (warn is a logging signal, not a deny)
    expect(lifted.allow.map((r) => r.pattern)).toContain("email.send_bulk");
    expect(lifted.deny.map((r) => r.pattern)).toContain("db.drop");
    expect(lifted.deny[0].reason).toBe("schema is locked");
  });

  it("propagates conditions into the most-restrictive composed constraints field", () => {
    const lifted = fromLegacyPolicy({
      id: "legacy-quota",
      rules: [
        {
          action: "ai.call",
          effect: "allow",
          conditions: { maxTokens: 4000, maxPerHour: 50 },
        },
        {
          action: "ai.expensive",
          effect: "allow",
          conditions: { maxTokens: 1000, requireApproval: true },
        },
      ],
    });
    // Most-restrictive across the two: tokens=1000, hours=50, approval=true
    expect(lifted.constraints?.maxTokensPerCall).toBe(1000);
    expect(lifted.constraints?.maxCallsPerHour).toBe(50);
    expect(lifted.constraints?.requireApproval).toBe(true);
  });
});

// ─── Verdict shape ────────────────────────────────────────────────────────

describe("mapl — verdict shape", () => {
  it("decidedBy identifies which atomic member resolved the verdict", () => {
    const composed = compose(P_API, P_OWNER);
    const v = evaluate(composed, "api.admin.users");
    expect(v.allowed).toBe(false);
    expect(v.decidedBy).toBe("api-only");
  });
  it("matchedPattern carries the glob that triggered the verdict", () => {
    // `api.*` is a single-segment match per L10 — so the matched action
    // also lives in two segments. Avoid 3-segment actions here, those
    // would (correctly) fall through to closed-world denial.
    const v = evaluate(P_API, "api.read");
    expect(v.allowed).toBe(true);
    expect(v.matchedPattern).toBe("api.*");
  });
});
