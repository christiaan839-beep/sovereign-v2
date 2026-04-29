/**
 * PACK AUTHORING SDK + VALIDATOR (R63).
 *
 * Converts the internal vertical-pack pattern into a publishable
 * SDK that third-party developers + enterprise customers can use to
 * author CUSTOM compliance packs. This is the substrate for the
 * "Sovereign Agency Marketplace" — once authoring is open, the
 * platform can grow from 5 internal packs to thousands of vetted
 * third-party packs.
 *
 * THE CONTRACT THIRD PARTIES IMPLEMENT:
 *
 *   1. Author a pack matching the VerticalPack interface (types.ts)
 *   2. Run validateAuthoredPack() to check it satisfies safety
 *      invariants (read-only by default, regulatory citations,
 *      HITL coverage, anti-slop guards, etc.)
 *   3. Submit to the Sovereign Marketplace for review
 *   4. Once approved, the pack is registered with a (pack-id,
 *      version) tuple and customers can deploy
 *
 * THE PUBLIC SDK SHIPS:
 *
 *   - validateAuthoredPack: pure-function structural + safety checks
 *   - PACK_SAFETY_INVARIANTS: documented requirements
 *   - validatePackHitlCoverage: ensures every adverse-action trigger
 *     has a HITL gate
 *   - validatePackComplianceCitations: ensures every HITL rule
 *     cites a regulatory authority (anti-slop)
 *
 * Pure-function design throughout. Same inputs → same outputs.
 * The validator runs both in CI (anti-drift) and at marketplace
 * submission time.
 *
 * IMPORTANT — see docs/LEGAL-COMPLIANCE-FRAMEWORK.md:
 *   - Third-party packs are AUTHORED by their creators, not by
 *     Sovereign. Customers deploying a pack assume the pack creator's
 *     compliance posture.
 *   - The validator catches structural failures; SUBSTANTIVE legal
 *     review remains the customer's responsibility.
 */

import type { VerticalPack, PackHitlRule, PackAuditQuery } from "./types";

// ── Validation result types ────────────────────────────────────────

export interface PackValidationFinding {
  /** Severity of the finding. */
  severity: "error" | "warning" | "info";
  /** Stable identifier for this finding (for filtering / suppression). */
  code: string;
  /** Human-readable explanation. */
  message: string;
  /** Where in the pack the issue surfaces (member, rule, query, etc.). */
  location?: string;
}

export interface PackValidationResult {
  ok: boolean;
  errors: PackValidationFinding[];
  warnings: PackValidationFinding[];
  info: PackValidationFinding[];
  /** Summary of which invariants passed/failed (for CI reporting). */
  invariantsChecked: number;
  invariantsPassed: number;
}

// ── Safety invariants (documented + machine-checkable) ─────────────

/**
 * The safety invariants every authored pack must satisfy. These are
 * NOT taste preferences — they're the guardrails that prevent a
 * malicious or careless pack author from shipping something that
 * would expose customers to liability.
 */
export const PACK_SAFETY_INVARIANTS = {
  HAS_VERSION: "pack must have a semver-style version string",
  HAS_OWNER_FIELD: "pack must declare a target buyer persona",
  HAS_FRAMEWORKS: "pack must declare at least one compliance framework",
  HAS_AGENTS: "pack must enable at least one agent",
  HAS_AUDIT_QUERIES: "pack must ship at least one pre-built audit query",
  READ_ONLY_DEFAULT_ACT_SCOPE:
    "pack default ACT scope must be read-only (max_cents: 0); " +
    "exceptions require explicit opt-in via SOVEREIGN_PACK_ALLOW_AUTONOMOUS_SPEND",
  HITL_RULES_HAVE_CITATIONS:
    "every HITL rule must cite a regulatory authority " +
    "(or 'INTERNAL_POLICY' for pack-author-defined rules)",
  ADVERSE_ACTIONS_HAVE_HITL:
    "any agent action that could produce an adverse decision " +
    "(reject, deny, terminate, exclude, file, submit, transmit) " +
    "must have at least one HITL rule covering it",
  AUDIT_QUERIES_HAVE_CONTEXT:
    "every audit query must declare an audienceContext naming " +
    "the regulator / auditor / forum it serves",
  PRICING_TIER_DECLARED: "pack must declare a pricing tier with ACV range",
  DAILY_LIMIT_BOUNDED:
    "default daily limit must be in [0, 100,000] cents " +
    "($0 - $1,000); higher requires explicit risk review",
  NO_BANNED_AGENTS:
    "pack must not enable agents from the banned-agent list " +
    "(adversarial / undisclosed-purpose / out-of-scope)",
  STAKES_TIER_DECLARED:
    "pack must declare an SLA tier (standard / professional / " +
    "enterprise / regulated)",
} as const;

const BANNED_AGENT_KEYWORDS = [
  "jailbreak",
  "exploit",
  "scraper-aggressive",
  "spam-blaster",
  "deepfake",
  "vote-manipulation",
] as const;

const ADVERSE_ACTION_KEYWORDS = [
  "reject",
  "deny",
  "denial",
  "terminate",
  "exclude",
  "blacklist",
  "ban",
  "suspend",
  "submit", // regulatory submissions
  "transmit", // outbound communications
  "file", // legal / regulatory filings
  "publish",
  "report.fincen",
  "report.ocr",
  "adverse_action",
] as const;

// ── The validator (pure function) ──────────────────────────────────

/**
 * Validate a third-party-authored pack. Returns structured findings
 * with severity. CI gate fails the build if errors > 0.
 *
 * Pure function. Same inputs → same outputs. No I/O.
 */
export function validateAuthoredPack(
  pack: VerticalPack,
): PackValidationResult {
  const errors: PackValidationFinding[] = [];
  const warnings: PackValidationFinding[] = [];
  const info: PackValidationFinding[] = [];
  let checked = 0;
  let passed = 0;

  function check(
    invariantKey: keyof typeof PACK_SAFETY_INVARIANTS,
    pass: boolean,
    severity: "error" | "warning" | "info" = "error",
    location?: string,
  ): void {
    checked++;
    if (pass) {
      passed++;
      return;
    }
    const finding: PackValidationFinding = {
      severity,
      code: invariantKey,
      message: PACK_SAFETY_INVARIANTS[invariantKey],
      location,
    };
    (severity === "error"
      ? errors
      : severity === "warning"
        ? warnings
        : info
    ).push(finding);
  }

  // Structural invariants.
  check("HAS_VERSION", /^\d+\.\d+\.\d+$/.test(pack.version));
  check(
    "HAS_OWNER_FIELD",
    typeof pack.targetBuyerPersona === "string" &&
      pack.targetBuyerPersona.length > 20,
  );
  check(
    "HAS_FRAMEWORKS",
    Array.isArray(pack.complianceFrameworks) &&
      pack.complianceFrameworks.length >= 1,
  );
  check("HAS_AGENTS", pack.enabledAgents.length >= 1);
  check("HAS_AUDIT_QUERIES", pack.auditQueries.length >= 1);
  check("PRICING_TIER_DECLARED", pack.pricingTier !== undefined);
  check(
    "STAKES_TIER_DECLARED",
    ["standard", "professional", "enterprise", "regulated"].includes(
      pack.slaTier,
    ),
  );

  // Read-only-by-default ACT scope.
  check(
    "READ_ONLY_DEFAULT_ACT_SCOPE",
    pack.defaultActScopes.max_cents === 0,
    "error",
    `defaultActScopes.max_cents = ${pack.defaultActScopes.max_cents}`,
  );

  // Daily limit bounded.
  check(
    "DAILY_LIMIT_BOUNDED",
    pack.defaultDailyLimitCents >= 0 &&
      pack.defaultDailyLimitCents <= 100_000,
    "error",
    `defaultDailyLimitCents = ${pack.defaultDailyLimitCents}`,
  );

  // Banned-agents check.
  let bannedFound = false;
  for (const agentId of pack.enabledAgents) {
    for (const banned of BANNED_AGENT_KEYWORDS) {
      if (agentId.toLowerCase().includes(banned)) {
        bannedFound = true;
        errors.push({
          severity: "error",
          code: "NO_BANNED_AGENTS",
          message: `enabledAgent "${agentId}" matches banned keyword "${banned}"`,
          location: `enabledAgents`,
        });
      }
    }
  }
  checked++;
  if (!bannedFound) passed++;

  // HITL rules — each must have a citation.
  let citationsOk = true;
  for (const rule of pack.hitlRules) {
    if (!rule.regulatoryCitation || rule.regulatoryCitation.length < 5) {
      citationsOk = false;
      errors.push({
        severity: "error",
        code: "HITL_RULES_HAVE_CITATIONS",
        message: `HITL rule "${rule.id}" missing regulatoryCitation`,
        location: `hitlRules.${rule.id}`,
      });
    }
  }
  checked++;
  if (citationsOk) passed++;

  // Adverse actions covered by at least one HITL rule.
  const adverseCovered = checkAdverseActionCoverage(pack);
  check(
    "ADVERSE_ACTIONS_HAVE_HITL",
    adverseCovered.covered,
    "warning",
    adverseCovered.uncovered.length > 0
      ? `uncovered triggers: ${adverseCovered.uncovered.join(", ")}`
      : undefined,
  );

  // Audit queries — each must declare audienceContext.
  let queryContextOk = true;
  for (const q of pack.auditQueries) {
    if (!q.audienceContext || q.audienceContext.length < 5) {
      queryContextOk = false;
      errors.push({
        severity: "error",
        code: "AUDIT_QUERIES_HAVE_CONTEXT",
        message: `audit query "${q.id}" missing audienceContext`,
        location: `auditQueries.${q.id}`,
      });
    }
  }
  checked++;
  if (queryContextOk) passed++;

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    info,
    invariantsChecked: checked,
    invariantsPassed: passed,
  };
}

// ── Adverse-action coverage checker (pure) ─────────────────────────

/**
 * Pure: check that every action in the pack's HITL rule triggers
 * + audit-query prefixes that LOOKS adverse has a HITL rule.
 *
 * Heuristic: scan rule triggers + audit-query action prefixes for
 * adverse-action keywords. If a keyword appears in audit queries
 * but no HITL rule trigger references it → coverage gap.
 */
export function checkAdverseActionCoverage(pack: VerticalPack): {
  covered: boolean;
  uncovered: string[];
} {
  const adverseKeywordsUsed = new Set<string>();
  // Scan audit queries for adverse-keyword usage.
  for (const q of pack.auditQueries) {
    for (const k of ADVERSE_ACTION_KEYWORDS) {
      if (q.actionPrefix.toLowerCase().includes(k)) {
        adverseKeywordsUsed.add(k);
      }
    }
  }
  // Scan HITL rules for adverse-keyword coverage.
  const adverseKeywordsCovered = new Set<string>();
  for (const r of pack.hitlRules) {
    for (const k of ADVERSE_ACTION_KEYWORDS) {
      if (r.trigger.toLowerCase().includes(k)) {
        adverseKeywordsCovered.add(k);
      }
    }
  }
  const uncovered: string[] = [];
  for (const k of adverseKeywordsUsed) {
    if (!adverseKeywordsCovered.has(k)) {
      uncovered.push(k);
    }
  }
  return {
    covered: uncovered.length === 0,
    uncovered,
  };
}

// ── Pure helpers ───────────────────────────────────────────────────

/**
 * Pure: check whether a single HITL rule has the required
 * regulatory citation. Used by the marketplace submission UI.
 */
export function isHitlRuleProperlyCited(rule: PackHitlRule): boolean {
  return (
    typeof rule.regulatoryCitation === "string" &&
    rule.regulatoryCitation.trim().length >= 5
  );
}

/**
 * Pure: check whether an audit query has the required audience
 * context.
 */
export function isAuditQueryProperlyContexted(q: PackAuditQuery): boolean {
  return (
    typeof q.audienceContext === "string" && q.audienceContext.trim().length >= 5
  );
}

/**
 * Pure: marketplace-submission readiness summary. Returns a
 * human-readable score (0-100) used in the marketplace UI to
 * gate publication.
 */
export function packReadinessScore(pack: VerticalPack): {
  score: number;
  ready: boolean;
  blockingErrors: number;
} {
  const result = validateAuthoredPack(pack);
  const score = Math.round(
    (result.invariantsPassed / Math.max(1, result.invariantsChecked)) * 100,
  );
  return {
    score,
    ready: result.ok,
    blockingErrors: result.errors.length,
  };
}
