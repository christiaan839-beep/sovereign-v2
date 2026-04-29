/**
 * VERTICAL AGENT PACKS — types.
 *
 * Round 47 — the move that converts Sovereign's 223 generic agents
 * into industry-specific PRODUCTS. A vertical pack is an opinionated
 * bundle of:
 *
 *   - Agents that should be enabled (allowlisted)
 *   - HITL routing rules tailored to the vertical's regulatory profile
 *   - Pre-configured ACT (R37) capability scopes
 *   - Pre-built audit-log queries the vertical's auditors actually ask for
 *   - Compliance framework mapping (which controls this pack satisfies)
 *   - Pre-set reliability + cost commitments (SLA tier)
 *
 * A pack is a PRODUCT. Customers buy "Banking Compliance Pack" the
 * same way they buy "Stripe Connect" or "Auth0 Enterprise". Generic
 * agents are infrastructure; packs are products.
 *
 * Pure data. The pack DEFINITION is opinionated knowledge encoded
 * as TypeScript; the actual deployment composes the pack + tenant
 * config at runtime.
 *
 * This file defines the SHAPE; banking-compliance.ts is the first
 * concrete pack.
 */

/**
 * The regulatory frameworks a vertical pack maps to. Used by
 * `/api/vertical-packs/<id>` to surface "this pack satisfies
 * controls X, Y, Z out-of-the-box." Procurement-readable.
 */
export type ComplianceFramework =
  | "soc2-type-ii"
  | "soc2-type-i"
  | "hipaa"
  | "eu-ai-act"
  | "nist-ai-rmf"
  | "occ-handbook"
  | "ffiec-it-handbook"
  | "sec-rule-17a-4"
  | "finra-3110"
  | "gdpr"
  | "ccpa"
  | "hitrust"
  | "pci-dss"
  | "iso-27001"
  | "fedramp-moderate"
  | "fedramp-high"
  | "cmmc-level-2"
  | "cmmc-level-3";

/**
 * SLA tier maps to the published reliability commitment for runs
 * in this pack. Higher tier → tighter latency, higher uptime,
 * stronger HITL thresholds.
 */
export type SlaTier = "standard" | "professional" | "enterprise" | "regulated";

/**
 * A canonical HITL rule from the pack's perspective. Mirror of the
 * shape in src/lib/hitl-routing-rules.ts but with vertical-specific
 * triggers (e.g., "any decision touching SAR/CTR data").
 */
export interface PackHitlRule {
  /** Stable id used in audit logs. */
  id: string;
  /** Procurement-readable description. */
  description: string;
  /** Trigger predicate as a free-form description (matches one of
   *  the operational rules in hitl-routing-rules.ts). */
  trigger: string;
  /** Required approver count. >=1; sequential approvals if multi. */
  requiredApprovers: number;
  /** Optional regulatory citation for "why this rule exists". */
  regulatoryCitation?: string;
}

/**
 * One canned audit-log query the pack ships with. Compliance
 * officers run these during examinations / audits without writing
 * SQL.
 *
 * The actual SQL stays in the route handler that consumes the pack
 * — this is JUST the metadata.
 */
export interface PackAuditQuery {
  id: string;
  title: string;
  description: string;
  /** Examination context: which auditor / framework asks for this. */
  audienceContext: string;
  /** The action prefix this query filters on (audit_logs.action LIKE). */
  actionPrefix: string;
  /** Default lookback window in days. */
  defaultWindowDays: number;
}

/**
 * A vertical pack. Opinionated, declarative, immutable per version.
 */
export interface VerticalPack {
  /** Stable identifier — `<industry>-<sub-vertical>`. */
  id: string;
  /** Display name. */
  name: string;
  /** Procurement-readable summary. */
  summary: string;
  /** Pack version (semver-like). */
  version: string;
  /** Target industry, free-form. */
  industry: string;
  /** Target buyer persona. Helps sales target the right title. */
  targetBuyerPersona: string;

  /** Compliance frameworks this pack supports out-of-the-box. */
  complianceFrameworks: ComplianceFramework[];

  /**
   * Allowlisted agent IDs. Customers using this pack get a curated
   * surface of agents pre-configured for their vertical, not the
   * full 223-agent registry.
   */
  enabledAgents: string[];

  /** HITL routing rules layered on top of the platform-default rules. */
  hitlRules: PackHitlRule[];

  /** Pre-built audit-log queries for examinations. */
  auditQueries: PackAuditQuery[];

  /**
   * SLA tier. Determines reliability commitments + cost-runaway base
   * + HITL stringency.
   */
  slaTier: SlaTier;

  /** Procurement-friendly key wins this pack delivers. */
  keyOutcomes: string[];

  /**
   * Default daily spend cap (cents) for agents in this pack. Stricter
   * than free-tier in regulated verticals. Composes with R42 credit
   * lines — agent reputation modulates this base.
   */
  defaultDailyLimitCents: number;

  /**
   * Default ACT (R37) capability scopes for agents in this pack.
   * E.g., banking compliance might pre-scope "max_cents: 0" so the
   * agents can only READ, never SPEND.
   */
  defaultActScopes: {
    max_cents: number;
    actions_allowed: string[];
    require_hitl_above_cents?: number;
  };

  /** Pricing positioning (US dollars, ACV). */
  pricingTier: {
    minAcvUsd: number;
    maxAcvUsd: number;
    targetCustomerSize: string;
  };
}
