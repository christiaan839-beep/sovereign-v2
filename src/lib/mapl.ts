/**
 * SOVEREIGN MATRIX — MAPL (Multi-Agent Policy Language) composition algebra (wave 113).
 *
 * `policy-engine.ts` (wave 78) evaluates a SINGLE policy against an
 * action. MAPL adds the missing layer above it: a closed algebra for
 * COMPOSING multiple policies into one effective policy that
 * preserves two load-bearing axioms.
 *
 * The algebra is intentionally minimal — three operations
 * (`compose`, `evaluate`, `mostRestrictive`), one identity element
 * (`TOP`), one bottom element (`BOTTOM`). The semantics are:
 *
 *   evaluate(p, action).allowed
 *     =  (∃ rule ∈ p.allow such that match(rule.pattern, action))
 *     ∧  (∄ rule ∈ p.deny  such that match(rule.pattern, action))
 *
 *   evaluate(compose(p1, p2), action).allowed
 *     =  evaluate(p1, action).allowed
 *     ∧  evaluate(p2, action).allowed
 *
 * The second equation is the **monotonic restriction axiom**: any
 * composed policy permits a subset of what every input permitted.
 * Equivalently, **transitive denial**: if any composed policy denies
 * an action, the composed policy denies it.
 *
 * Algebraic laws verified by the contract tests:
 *   - identity:        compose(p, TOP) ≡ p
 *   - bottom:          evaluate(compose(p, BOTTOM), *).allowed = false
 *   - idempotence:     evaluate(compose(p, p), *) ≡ evaluate(p, *)
 *   - commutativity:   evaluate(compose(p1, p2), *) ≡ evaluate(compose(p2, p1), *)
 *   - associativity:   evaluate(compose(compose(p1, p2), p3), *) ≡ evaluate(compose(p1, compose(p2, p3)), *)
 *   - monotonic restriction: allowed(compose(p1, p2)) ⊆ allowed(p1)
 *   - transitive denial:     denied(p_i) ⇒ denied(compose(...p1..pn..))
 *
 * Composition is implemented by structural flattening — `compose`
 * accumulates references to the input policies in `members`; the
 * evaluator iterates members and AND-s their verdicts. This is
 * O(n) in member count per evaluation but lets us preserve the
 * algebraic laws structurally rather than re-prove them on each
 * call. Re-proving them via materialised allow/deny merging is
 * tempting but introduces a class of bugs around glob-pattern
 * intersection that this design dodges entirely.
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("mapl");

// ─── Types ─────────────────────────────────────────────────────────────────

export type MaplEffect = "allow" | "deny";

export interface MaplRule {
  /** Glob pattern over the action namespace: "api.*", "db.write". */
  pattern: string;
  effect: MaplEffect;
  reason?: string;
}

export interface MaplConstraints {
  /** Cap on tokens per single call. Most-restrictive = min. */
  maxTokensPerCall?: number;
  /** Cap on calls per hour. Most-restrictive = min. */
  maxCallsPerHour?: number;
  /** When true, action requires HITL approval. ANY true wins. */
  requireApproval?: boolean;
  /** Allowed wall-clock window (24h). Most-restrictive = intersection. */
  allowedHours?: { start: number; end: number };
}

export interface MaplPolicy {
  id: string;
  allow: MaplRule[];
  deny: MaplRule[];
  constraints?: MaplConstraints;
  /**
   * When set, this policy is a structural composition of its
   * `members`. `compose()` flattens nested compositions so the array
   * never contains another composed policy — every entry is atomic.
   */
  members?: MaplPolicy[];
}

export interface MaplVerdict {
  allowed: boolean;
  /** "allow rule matched" / "deny rule matched" / "no allow rule matched". */
  reason: string;
  /** Which member policy decided (for composed policies). */
  decidedBy: string | null;
  /** The matched pattern, if any. */
  matchedPattern: string | null;
  /** Effective constraints after most-restrictive composition. */
  constraints?: MaplConstraints;
}

// ─── Identity / Bottom elements ────────────────────────────────────────────

/**
 * Identity element. `compose(p, TOP) ≡ p` semantically — TOP allows
 * everything and denies nothing, so the conjunction is unchanged.
 */
export const TOP: MaplPolicy = Object.freeze({
  id: "TOP",
  allow: [{ pattern: "**", effect: "allow", reason: "TOP allows all" }],
  deny: [],
}) as MaplPolicy;

/**
 * Bottom element. `compose(p, BOTTOM)` denies everything because
 * BOTTOM's allow set is empty. Useful as a kill-switch policy that
 * any operator can compose into the policy stack to immediately
 * lock down an environment.
 */
export const BOTTOM: MaplPolicy = Object.freeze({
  id: "BOTTOM",
  allow: [],
  deny: [{ pattern: "**", effect: "deny", reason: "BOTTOM denies all" }],
}) as MaplPolicy;

// ─── Pattern matching ──────────────────────────────────────────────────────

/**
 * Minimal glob match for the action namespace:
 *   `*`  matches any single segment (no dot)
 *   `**` matches any sequence including dots
 *
 * Implemented by escaping all regex metas EXCEPT `*` and `.`, then
 * substituting the two glob tokens with their regex equivalents.
 */
export function matchGlob(pattern: string, action: string): boolean {
  if (typeof pattern !== "string" || typeof action !== "string") return false;
  if (pattern === action) return true;
  // The substitution order matters. We must:
  //   1. escape regex meta (incl. literal `.`) FIRST,
  //   2. protect `**` with a placeholder that survives the escape pass,
  //   3. replace single `*` → `[^.]*` (single-segment match),
  //   4. restore the `**` placeholder → `.*` (cross-segment match).
  // The earlier ordering escaped dots AFTER substituting `**` → `.*`,
  // which broke cross-segment patterns by escaping the dots inside `.*`.
  const regexSrc =
    "^" +
    pattern
      .replace(/[+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\./g, "\\.")
      .replace(/\*\*/g, "::DS::")
      .replace(/\*/g, "[^.]*")
      .replace(/::DS::/g, ".*") +
    "$";
  try {
    return new RegExp(regexSrc).test(action);
  } catch {
    return false;
  }
}

// ─── Atomic evaluation ─────────────────────────────────────────────────────

/**
 * Evaluate an action against a single ATOMIC policy (one without
 * `members`). The composed-policy path lives in `evaluate()`.
 *
 * Order of operations:
 *   1. Walk deny rules first — any match denies. (Transitive denial
 *      is preserved structurally because composed denies are the
 *      union of input denies.)
 *   2. Walk allow rules — any match permits.
 *   3. If no rule matches at all, the result is `denied` with reason
 *      "no allow rule matched" (closed-world default — safer than
 *      open-world default in a security context).
 */
function evaluateAtomic(p: MaplPolicy, action: string): MaplVerdict {
  for (const rule of p.deny) {
    if (matchGlob(rule.pattern, action)) {
      return {
        allowed: false,
        reason: rule.reason ?? `denied by ${p.id}: ${rule.pattern}`,
        decidedBy: p.id,
        matchedPattern: rule.pattern,
      };
    }
  }
  for (const rule of p.allow) {
    if (matchGlob(rule.pattern, action)) {
      return {
        allowed: true,
        reason: rule.reason ?? `allowed by ${p.id}: ${rule.pattern}`,
        decidedBy: p.id,
        matchedPattern: rule.pattern,
      };
    }
  }
  return {
    allowed: false,
    reason: `no allow rule matched in ${p.id} (closed-world default)`,
    decidedBy: p.id,
    matchedPattern: null,
  };
}

// ─── Composition ───────────────────────────────────────────────────────────

/**
 * `mostRestrictive(c1, c2)` — fold constraints toward the strictest
 * possible value:
 *   - numeric caps: min
 *   - boolean `requireApproval`: OR (any true wins)
 *   - `allowedHours`: intersection of windows (closed empty when disjoint)
 *
 * Constraints are not used for the allow/deny decision; they're an
 * out-of-band channel that downstream callers (rate-limiter,
 * HITL gate, scheduler) consume.
 */
export function mostRestrictive(
  c1?: MaplConstraints,
  c2?: MaplConstraints,
): MaplConstraints | undefined {
  if (!c1 && !c2) return undefined;
  const a = c1 ?? {};
  const b = c2 ?? {};
  const out: MaplConstraints = {};
  if (a.maxTokensPerCall != null || b.maxTokensPerCall != null) {
    out.maxTokensPerCall = Math.min(
      a.maxTokensPerCall ?? Number.POSITIVE_INFINITY,
      b.maxTokensPerCall ?? Number.POSITIVE_INFINITY,
    );
  }
  if (a.maxCallsPerHour != null || b.maxCallsPerHour != null) {
    out.maxCallsPerHour = Math.min(
      a.maxCallsPerHour ?? Number.POSITIVE_INFINITY,
      b.maxCallsPerHour ?? Number.POSITIVE_INFINITY,
    );
  }
  if (a.requireApproval || b.requireApproval) {
    out.requireApproval = true;
  }
  if (a.allowedHours || b.allowedHours) {
    const left = a.allowedHours ?? { start: 0, end: 24 };
    const right = b.allowedHours ?? { start: 0, end: 24 };
    const start = Math.max(left.start, right.start);
    const end = Math.min(left.end, right.end);
    out.allowedHours = { start, end };
  }
  return out;
}

/**
 * Flatten the `members` of a composed policy so the result's
 * `members` never contains another composed policy. This is what
 * gives us associativity for free.
 */
function flatten(p: MaplPolicy): MaplPolicy[] {
  if (!p.members || p.members.length === 0) return [p];
  return p.members.flatMap((m) => flatten(m));
}

/**
 * Compose two policies into their algebraic intersection. The
 * resulting policy:
 *   - permits an action ⇔ every input permits it,
 *   - denies an action  ⇔ any input denies it.
 *
 * Implementation: structural flattening into `members`. The
 * evaluator iterates members and short-circuits on first denial.
 */
export function compose(p1: MaplPolicy, p2: MaplPolicy): MaplPolicy {
  const members = [...flatten(p1), ...flatten(p2)];
  return {
    id: `${p1.id}∩${p2.id}`,
    allow: [],
    deny: [],
    constraints: mostRestrictive(p1.constraints, p2.constraints),
    members,
  };
}

/**
 * Fold-compose a variadic list of policies. Returns TOP when called
 * with zero policies (TOP is the identity element).
 */
export function composeAll(...policies: MaplPolicy[]): MaplPolicy {
  if (policies.length === 0) return TOP;
  return policies.reduce((acc, p) => compose(acc, p));
}

// ─── Public evaluator ──────────────────────────────────────────────────────

/**
 * Evaluate an action against a policy (atomic or composed).
 *
 * For composed policies: iterate members, short-circuit on first
 * denial (preserves transitive denial); if every member allows,
 * the composed policy allows. The verdict's `decidedBy` field
 * names the member that decided.
 *
 * The composed verdict carries the most-restrictive constraints so
 * downstream callers can see the effective caps + HITL flags without
 * walking the policy tree themselves.
 */
export function evaluate(p: MaplPolicy, action: string): MaplVerdict {
  if (!p.members || p.members.length === 0) {
    const v = evaluateAtomic(p, action);
    if (p.constraints) v.constraints = p.constraints;
    return v;
  }
  for (const member of p.members) {
    const v = evaluateAtomic(member, action);
    if (!v.allowed) {
      const out: MaplVerdict = {
        allowed: false,
        reason: v.reason,
        decidedBy: v.decidedBy,
        matchedPattern: v.matchedPattern,
      };
      if (p.constraints) out.constraints = p.constraints;
      return out;
    }
  }
  const out: MaplVerdict = {
    allowed: true,
    reason: `allowed by all ${p.members.length} composed policies`,
    decidedBy: p.id,
    matchedPattern: action,
  };
  if (p.constraints) out.constraints = p.constraints;
  return out;
}

// ─── Convenience constructor ───────────────────────────────────────────────

/**
 * Build a policy from a compact spec. Useful for tests and for the
 * thin adapters that wrap legacy `policy-engine.Policy` objects into
 * `MaplPolicy` shape.
 */
export function policy(spec: {
  id: string;
  allow?: Array<string | MaplRule>;
  deny?: Array<string | MaplRule>;
  constraints?: MaplConstraints;
}): MaplPolicy {
  const norm = (s: string | MaplRule, effect: MaplEffect): MaplRule =>
    typeof s === "string" ? { pattern: s, effect } : s;
  return {
    id: spec.id,
    allow: (spec.allow ?? []).map((s) => norm(s, "allow")),
    deny: (spec.deny ?? []).map((s) => norm(s, "deny")),
    constraints: spec.constraints,
  };
}

// ─── Adapter from the legacy policy-engine.Policy shape ────────────────────

/**
 * Lift a single legacy `Policy` (from `src/lib/policy-engine.ts`)
 * into a `MaplPolicy`. Rules with effect "warn" are treated as
 * allow (warn is a logging signal, not a deny). The `id` is
 * preserved so audit logs cross-reference cleanly.
 *
 * Imported lazily as `unknown` to avoid a static import cycle with
 * policy-engine (which may evolve independently).
 */
export function fromLegacyPolicy(legacy: {
  id: string;
  rules: Array<{
    action: string;
    effect: "allow" | "deny" | "warn";
    reason?: string;
    conditions?: {
      maxTokens?: number;
      maxPerHour?: number;
      requireApproval?: boolean;
      allowedHours?: { start: number; end: number };
    };
  }>;
}): MaplPolicy {
  const allow: MaplRule[] = [];
  const deny: MaplRule[] = [];
  let constraints: MaplConstraints | undefined;
  for (const r of legacy.rules) {
    if (r.effect === "deny") {
      deny.push({ pattern: r.action, effect: "deny", reason: r.reason });
    } else {
      // both "allow" and "warn" are non-denials from MAPL's POV
      allow.push({ pattern: r.action, effect: "allow", reason: r.reason });
    }
    if (r.conditions) {
      const c: MaplConstraints = {};
      if (r.conditions.maxTokens != null)
        c.maxTokensPerCall = r.conditions.maxTokens;
      if (r.conditions.maxPerHour != null)
        c.maxCallsPerHour = r.conditions.maxPerHour;
      if (r.conditions.requireApproval) c.requireApproval = true;
      if (r.conditions.allowedHours) c.allowedHours = r.conditions.allowedHours;
      constraints = mostRestrictive(constraints, c);
    }
  }
  return { id: legacy.id, allow, deny, constraints };
}

log.debug("mapl module loaded");
