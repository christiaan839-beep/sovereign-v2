/**
 * Move 23 — Single source of truth for `/trust/wiring-status` page.
 *
 * Every R-numbered trust primitive Sovereign Matrix ships gets one
 * entry here with: its status (wired / library / roadmap), the
 * source file you can grep, the audit action it fires (if any),
 * the test count, and a one-line procurement-readable description.
 *
 * The /trust/wiring-status page renders this list. The /security
 * page's "Trust Surface" section renders a curated subset. Both
 * read from this file — drift is impossible.
 *
 * Anti-drift gate (weekly-health.mjs): every R-numbered primitive
 * imported elsewhere in the codebase MUST have an entry here.
 *
 * STATUS SEMANTICS:
 *   - "wired"   : runtime gate fires per request; audit chain
 *                 receives the declared action
 *   - "library" : pure-function code with tests, no runtime call
 *                 site yet (transparency: we say so explicitly)
 *   - "roadmap" : declared as forthcoming; not built yet
 *   - "live"    : public surface (route, spec, doc); not a gate
 *                 but a publication
 */

export type TrustStatus = "wired" | "library" | "roadmap" | "live";

export interface TrustEntry {
  /** R-tag where applicable (e.g. "R142") or short identifier. */
  tag: string;
  /** Procurement-readable name. */
  name: string;
  /** Status — see semantics above. */
  status: TrustStatus;
  /** Source file you can `grep` to verify. */
  source: string;
  /** Audit action fired (if any). */
  auditAction?: string;
  /** Number of unit tests covering the primitive. */
  testCount?: number;
  /** Public URL where applicable. */
  publicUrl?: string;
  /** One-sentence description for procurement reviewers. */
  description: string;
  /** Anti-drift invariant id in weekly-health.mjs (when applicable). */
  invariantId?: string;
}

export const TRUST_REGISTRY: ReadonlyArray<TrustEntry> = [
  // ── Foundation (R26-R44 era — wired in production) ─────────────
  {
    tag: "R26",
    name: "SHA-256 audit chain",
    status: "wired",
    source: "src/lib/audit-log.ts",
    testCount: 8,
    description:
      "Every state-changing action is hash-chained. Tampering breaks the chain; cron verifies every 6h.",
    invariantId: "audit-chain-tampering-3-scenarios",
  },
  {
    tag: "R34",
    name: "Capability-attenuated delegation",
    status: "wired",
    source: "src/lib/agent-capability-tokens.ts",
    auditAction: "commerce.authorize",
    testCount: 30,
    description:
      "Delegation tokens narrow capabilities at every hop. Agents cannot escalate.",
  },
  {
    tag: "R37",
    name: "Macaroon-pattern attenuatable tokens",
    status: "wired",
    source: "src/lib/agent-capability-tokens.ts",
    auditAction: "api_key.create",
    testCount: 30,
    description:
      "Capability tokens with explicit narrowing. Composes with R34, R91.",
  },
  {
    tag: "R38",
    name: "Know-Your-Agent identity registry",
    status: "wired",
    source: "src/lib/agent-identity.ts",
    auditAction: "agent.execute",
    testCount: 12,
    description: "Identity manifests for every shipped agent. SBOM-grade lineage.",
  },
  {
    tag: "R100",
    name: "Declared policy gate",
    status: "wired",
    source: "src/lib/agent-factory-policy-gate.ts",
    auditAction: "agent.policy_gate.deny",
    testCount: 14,
    description:
      "Procurement-grade rule enforcement before action. Default-OFF flag.",
  },
  // ── PII / cost / scoping (cross-cutting hardening) ─────────────
  {
    tag: "PII",
    name: "PII output guard (regex + Luhn + IBAN + SWIFT)",
    status: "wired",
    source: "src/lib/pii-guard.ts",
    testCount: 23,
    description:
      "Pure-function structural scrubber. SSN, credit card (Luhn), IBAN (mod-97), SWIFT/BIC, email, phone.",
  },
  {
    tag: "ScopeAuth",
    name: "API-key scoping (CIDR + per-agent)",
    status: "wired",
    source: "src/lib/api-key-scopes.ts",
    testCount: 13,
    description:
      "Per-key scopes / CIDR allowlists / per-agent allowlists. Fail-closed.",
  },
  {
    tag: "FreeFirst",
    name: "Free-first model router",
    status: "wired",
    source: "src/lib/ai.ts",
    testCount: 4,
    description:
      "SOVEREIGN_FREE_ONLY mode strips paid providers from failover chain.",
  },
  // ── Tier 1 wired (Moves 17-21, May 2026) ────────────────────────
  {
    tag: "R142",
    name: "Pre-Action Governance Loop (PAGRL)",
    status: "wired",
    source: "src/lib/control-plane/governance.ts",
    auditAction: "agent.governance_consult",
    testCount: 35,
    description:
      "4-layer ruleset consultation (global → workflow → agent → situational) before every consequential action. SOC 2 / EU AI Act trace.",
  },
  {
    tag: "R145",
    name: "Memory payload guard (zombie-memory defense)",
    status: "wired",
    source: "src/lib/memory/payload-guard.ts",
    auditAction: "agent.memory_payload_blocked",
    testCount: 42,
    description:
      "5-detector scanner gates every memory write. Refuses embedded-instruction payloads. Cross-agent contagion correlation by content-hash.",
  },
  {
    tag: "R150",
    name: "Agentic Bill of Materials (AIBOM)",
    status: "wired",
    source: "src/lib/supply-chain/aibom.ts",
    auditAction: "agent.sbom_generated",
    publicUrl: "/.well-known/aibom.json",
    testCount: 32,
    description:
      "Per-deploy AIBOM with SHA-256 component fingerprints + SPDX-style relationships. OWASP ASI04. EU AI Act Art. 13.",
  },
  {
    tag: "R155",
    name: "HITL confidence routing",
    status: "wired",
    source: "src/lib/control-plane/hitl-routing.ts",
    auditAction: "agent.governance_consult",
    testCount: 22,
    description:
      "Calibrated routing: auto_proceed | silent_approval | hitl_required | hard_deny. Composes with policy + viability + ODTA.",
  },
  {
    tag: "R162",
    name: "Cross-protocol privilege bridge",
    status: "wired",
    source: "src/lib/protocols/cross-protocol-bridge.ts",
    auditAction: "agent.cross_protocol_block",
    publicUrl: "/api/v1/a2a/[peer]",
    testCount: 19,
    description:
      "A2A → MCP least-privilege bridge with REFUSE_ALL default policy. Privilege-escalation defense.",
  },
  // ── Public surfaces (live discovery / verification) ───────────
  {
    tag: "R160",
    name: "A2A Agent Card publication",
    status: "live",
    source: "src/lib/protocols/a2a/agent-card.ts",
    publicUrl: "/.well-known/agent.json",
    testCount: 37,
    description:
      "Google A2A v1.0 Agent Card with SHA-256 fingerprint. MITM-detectable. X-Sovereign-Card-Fingerprint header.",
  },
  {
    tag: "Verifier",
    name: "Public verifier endpoint",
    status: "live",
    source: "src/app/api/v1/verify/[surface]/route.ts",
    publicUrl: "/api/v1/verify/{surface}",
    testCount: 16,
    description:
      "6 surfaces: audit-chain, agent-card, aibom, scope-evaluation, bridge-authorization, memory-payload. Curl-able by any auditor.",
  },
  {
    tag: "AuditHead",
    name: "Public audit-chain head (pinable anchor)",
    status: "live",
    source: "src/app/api/v1/audit/head/route.ts",
    publicUrl: "/api/v1/audit/head",
    testCount: 6,
    description:
      "Returns rowHash + rowN + signedAt. Save today; verify the historical row at rowN matches weeks later.",
  },
  {
    tag: "Spec",
    name: "Sovereign Trust Manifest 1.0 (open spec)",
    status: "live",
    source: "docs/SOVEREIGN_TRUST_MANIFEST_SPEC.md",
    publicUrl: "/.well-known/sovereign-trust",
    testCount: 9,
    description:
      "CC BY 4.0 open spec. JSON Schema published. Conformance test enforces drift-zero.",
  },
  {
    tag: "Inspector",
    name: "@sovereign/inspector CLI (offline verifier)",
    status: "live",
    source: "packages/inspector",
    description:
      "Pure-function offline verifier. Validates fetched manifests + audit chains + AIBOMs without contacting Sovereign.",
  },
  // ── Library-ready (built, not yet wired) ───────────────────────
  {
    tag: "R140",
    name: "Behavioral Invariant Layer (IML drift)",
    status: "library",
    source: "src/lib/control-plane/viability.ts",
    auditAction: "agent.drift_detected",
    testCount: 18,
    description:
      "KL divergence + segment-vs-rest z-test + sequential pattern-match drift detection. Telemetry stream not yet feeding the gate.",
  },
  {
    tag: "R141",
    name: "Continuous Viability Index VI(t)",
    status: "library",
    source: "src/lib/control-plane/viability.ts",
    auditAction: "agent.viability_threshold",
    testCount: 14,
    description:
      "Score in [-1, +1]. Predictive trust signal — drops BEFORE violation. Score not yet consumed by gates.",
  },
  {
    tag: "R143",
    name: "ODTA runtime placement gate",
    status: "library",
    source: "src/lib/control-plane/odta.ts",
    testCount: 9,
    description:
      "4-predicate test (Observability/Decidability/Timeliness/Attestability) before agent dispatch. Wiring scheduled.",
  },
  {
    tag: "R161",
    name: "MCP Tool Gateway (streamable-HTTP transport)",
    status: "library",
    source: "src/lib/protocols/mcp/tool-descriptor.ts",
    testCount: 24,
    description:
      "Tool descriptor + scope grammar shipped. Streamable-HTTP transport pending stable spec version.",
  },
  // ── Roadmap (declared honestly) ────────────────────────────────
  {
    tag: "R143-eBPF",
    name: "Kernel-level kill switch (eBPF)",
    status: "roadmap",
    source: "—",
    description:
      "AgentSight-style syscall tracing with userspace control plane. Multi-session arc; deferred to Q3 2026.",
  },
  {
    tag: "R166",
    name: "Owner-Harm detector",
    status: "roadmap",
    source: "—",
    description:
      "Detects when agent action harms its operator (e.g., spending against undeclared goals). Needs deployer-policy schema.",
  },
  {
    tag: "SAML",
    name: "SAML / SCIM enterprise SSO",
    status: "roadmap",
    source: "—",
    description:
      "Requires Clerk Enterprise plan. Q3 2026. Today: Google + Microsoft OAuth via Clerk standard tier.",
  },
  {
    tag: "SOC2",
    name: "SOC 2 Type II certification",
    status: "roadmap",
    source: "—",
    description:
      "External auditor engagement in progress. ETA Q3 2026.",
  },
  {
    tag: "Federation",
    name: "Federated peer registry",
    status: "roadmap",
    source: "src/app/.well-known/sovereign-trust/route.ts (federation field stub)",
    description:
      "Cross-instance peer crawl + reputation portability. Needs 2+ peer implementors first.",
  },
];

/** Convenience accessors for the page renderer. */
export function entriesByStatus(status: TrustStatus): ReadonlyArray<TrustEntry> {
  return TRUST_REGISTRY.filter((e) => e.status === status);
}

export const STATUS_DESCRIPTIONS: Record<TrustStatus, string> = {
  wired:
    "Runtime gate fires per request. The cited audit action lands on the R26 hash chain.",
  live:
    "Public surface (route, spec, or document). Not a gate but a publication anyone can probe.",
  library:
    "Pure-function code with tests; no runtime call site yet. Transparency: we say so explicitly.",
  roadmap:
    "Declared as forthcoming with a target. Not yet built.",
};
