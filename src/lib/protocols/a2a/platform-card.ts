/**
 * Sovereign Matrix platform-level Agent Card configuration.
 *
 * SINGLE SOURCE OF TRUTH for which trust capabilities the platform
 * declares to external peers. Imported by:
 *   - /.well-known/agent.json     (R160 Agent Card publication)
 *   - /.well-known/sovereign-trust (R36 federation manifest)
 *
 * WHY CENTRALIZE? If the two manifests drift on what we claim to
 * support, we set up a credibility gap (an A2A peer sees one
 * capability list; an inspector running against the federation
 * manifest sees a different one). This file makes drift structurally
 * impossible — both manifests import from here.
 *
 * CAPABILITY NAMING DISCIPLINE:
 *   - kebab-case
 *   - suffixed with R-number for procurement cross-reference
 *   - one capability ↔ one shipped library + audit-vocabulary entry
 *   - capabilities are UNDERSTATEMENTS of features (e.g. "audit-chain-r26"
 *     covers tamper-evident hash chain WITH Vercel-Cron verification),
 *     keeping the spec citable in two pages.
 */

import { buildAgentCard, type A2AAgentCard } from "./agent-card";

/**
 * The complete list of platform-level trust capabilities Sovereign
 * Matrix declares externally. Each entry maps to an R-numbered
 * primitive shipped in the codebase. New entries appear ONLY when
 * the corresponding library + audit-vocabulary entry is live in main.
 *
 * This list is the procurement-grade "what does Sovereign claim to do"
 * surface. Auditors cross-reference these names against:
 *   - docs/THREAT_MODEL.md
 *   - audit-log.ts AuditAction union
 *   - inspector verifier subcommands
 */
export const SOVEREIGN_PLATFORM_CAPABILITIES = [
  // R26 — tamper-evident hash chain (audit-log.ts)
  "audit-chain-r26",
  // R30 — agentic-commerce spend authorizations
  "spend-authorizations-r30",
  // R33 — multi-stage human-in-the-loop
  "multi-stage-hitl-r33",
  // R34 — capability-attenuated delegation chain
  "delegation-chain-r34",
  // R37 — Macaroon-pattern attenuatable capability tokens
  "agent-capability-tokens-r37",
  // R38 — Know-Your-Agent identity manifest registry
  "agent-identity-registry-r38",
  // R100 — declared-policy gate (procurement-grade rule enforcement)
  "policy-gate-r100",
  // R140 — Behavioral Invariant Layer (drift detection above policy)
  "behavioral-invariant-iml-r140",
  // R141 — Continuous Viability Index (predictive trust score)
  "viability-riskgate-r141",
  // R142 — Pre-Action Governance Reasoning Loop (4-layer ruleset)
  "governance-loop-r142",
  // R143 — Observability/Decidability/Timeliness/Attestability gate
  "odta-runtime-gate-r143",
  // R145 — embedded-payload guard for memory writes
  "memory-payload-guard-r145",
  // R150 — Agentic Bill of Materials (supply-chain attestation)
  "aibom-r150",
  // R155 — Confidence-calibrated HITL routing
  "hitl-confidence-routing-r155",
  // R160 — Google A2A Agent Card (this primitive itself)
  "agent-card-a2a-r160",
  // R161 — MCP Tool Gateway with scope grammar
  "mcp-tool-gateway-r161",
  // R162 — Cross-protocol privilege alignment (least-privilege bridge)
  "cross-protocol-bridge-r162",
  // Cross-cutting — the moat: every claim above can be re-verified
  // offline by @sovereign/inspector running on the auditor's laptop.
  "inspector-verifiable",
] as const;

export type SovereignPlatformCapability =
  (typeof SOVEREIGN_PLATFORM_CAPABILITIES)[number];

/**
 * Auth schemes the platform's A2A surface accepts. Listed in
 * preference order: ACT (R37 native, finest-grained attenuation)
 * → ACAT (commerce-class, R91) → API key (legacy/external).
 */
export const SOVEREIGN_PLATFORM_AUTH_SCHEMES = [
  "act-token",
  "acat-mandate",
  "api-key",
] as const;

/** Stable agent id for the platform-level card. Kebab-case, ≤ 64 chars. */
export const SOVEREIGN_PLATFORM_AGENT_ID = "sovereign-matrix-platform";

/** Free-form supplier label declared by the card. */
export const SOVEREIGN_PLATFORM_SUPPLIER = "Sovereign Matrix";

/**
 * Pure: build the canonical platform Agent Card from a known host
 * and publish timestamp. Used by:
 *   - the /.well-known/agent.json route handler
 *   - tests, for snapshot-stable validation
 *   - the inspector port, for offline replay
 *
 * The fingerprint is computed deterministically over the canonical
 * encoding (see canonicalEncodeAgentCard in agent-card.ts). Any
 * tampering with id/capabilities/authSchemes/endpoints breaks it.
 */
export function buildSovereignPlatformAgentCard(args: {
  canonicalHost: string;
  publishedAt: string;
}): A2AAgentCard {
  return buildAgentCard({
    protocolVersion: "1.0",
    id: SOVEREIGN_PLATFORM_AGENT_ID,
    name: "Sovereign Matrix",
    description:
      "The cryptographically-trustable compute layer for agentic commerce. " +
      "Every action is hash-chained, scope-bounded, cost-capped, governance-consulted, " +
      "viability-scored, and verifiable offline via @sovereign/inspector.",
    supplier: SOVEREIGN_PLATFORM_SUPPLIER,
    capabilities: [...SOVEREIGN_PLATFORM_CAPABILITIES],
    authSchemes: [...SOVEREIGN_PLATFORM_AUTH_SCHEMES],
    endpoints: {
      rpc: `https://${args.canonicalHost}/api/v1`,
    },
    homepage: `https://${args.canonicalHost}`,
    regulatoryNotes: [
      "EU AI Act Art. 3(23) substantial-modification monitoring (R140 IML)",
      "OWASP ASI04 supply-chain attestation (R150 AIBOM)",
      "SOC 2 immutable audit chain (R26 hash chain + R34 delegation)",
      "OWASP ASI03 cross-protocol privilege escalation defense (R162)",
    ],
    publishedAt: args.publishedAt,
  });
}
