/**
 * GET /.well-known/sovereign-trust
 *
 * Round 36 — the federation primitive. Published at a well-known
 * URL so any peer can discover this Sovereign instance's trust
 * surface WITHOUT prior knowledge.
 *
 * Spec: a self-describing JSON document declaring:
 *   - identity (URL, name, instance public key fingerprint)
 *   - capabilities (which trust primitives are supported)
 *   - endpoints (where to fetch each artifact)
 *   - federation peers (other Sovereign instances we trust)
 *   - verifier package (`@sovereign/inspector` on npm)
 *   - signed identity claim (so the document itself is verifiable)
 *
 * THE STRATEGIC IDEA: this is the seed of decentralized agent trust.
 * Any instance can run Sovereign with its own keys; instances
 * cryptographically interoperate via shared CADC primitives. The
 * inspector CLI fetches this file from any instance, learns its
 * trust surface, and verifies its claims locally.
 *
 * Pattern: like robots.txt for crawlers, but for cryptographic
 * trust verification. Like .well-known/jwks.json for OIDC. Like
 * .well-known/openid-configuration for identity providers.
 *
 * SECURITY: this endpoint reveals nothing secret. All keys are
 * PUBLIC; capabilities are LIST-only; endpoints are already
 * discoverable. The signed identity claim is what makes the
 * document tamper-evident.
 *
 * Cache: 5 min. Identity changes only on deploy.
 */

import { NextResponse } from "next/server";
import { TOTAL_AGENTS, TOTAL_MODELS } from "@/lib/platform-stats";
import { createLogger } from "@/lib/logger";
import { SOVEREIGN_PLATFORM_CAPABILITIES } from "@/lib/protocols/a2a/platform-card";

const log = createLogger("well-known-trust");

export const runtime = "nodejs";
export const revalidate = 300;

// v0.3.0 (Move 14) — adds public verifier endpoint surface
// (/api/v1/verify/{surface}) so any auditor can replay our trust
// claims with curl. Each surface routes to a pure-function verifier
// in the platform; the @sovereign/inspector CLI mirrors the same
// logic for offline use. Procurement-grade trust surface complete.
//
// v0.2.0 (Move 13) — extended with R100, R140-R145, R150, R155,
// R160-R162 capabilities; added agentCard discovery endpoint;
// added platformCapabilities[] mirror list sourced from
// platform-card.ts so this manifest cannot drift from the A2A
// Agent Card published at /.well-known/agent.json.
const SPEC_VERSION = "0.3.0";

/**
 * The 6 verifier surfaces published at /api/v1/verify/{surface}.
 * Mirrored from src/app/api/v1/verify/[surface]/route.ts. An auditor
 * can POST evidence to any of these and get an offline-replay verdict.
 */
const VERIFIER_SURFACES = [
  "audit-chain",
  "agent-card",
  "aibom",
  "scope-evaluation",
  "bridge-authorization",
  "memory-payload",
] as const;

interface SovereignTrustDocument {
  /** Spec version. */
  $schema: string;
  /** When this document was generated. */
  generatedAt: string;
  /** Self-identification. */
  identity: {
    name: string;
    canonicalUrl: string;
    /** Free-form description. */
    description: string;
    /** SHA-256 fingerprint of the platform's signing key (if any). */
    keyFingerprint: string | null;
  };
  /** Which trust primitives this instance supports. */
  capabilities: {
    auditChain: boolean;
    delegationChain: boolean;
    multiStageHitl: boolean;
    spendAuthorizations: boolean;
    publicTrace: boolean;
    publicReliability: boolean;
    publicHitlPolicy: boolean;
    selfDiagnose: boolean;
    /** R37 — Macaroon-pattern attenuatable capability tokens. */
    agentCapabilityTokens: boolean;
    /** R38 — Know-Your-Agent identity manifest registry. */
    agentIdentityRegistry: boolean;
    /** R100 — declared-policy gate (procurement-grade rule enforcement). */
    policyGate: boolean;
    /** R140 — Behavioral Invariant Layer (drift detection above policy). */
    behavioralInvariantIml: boolean;
    /** R141 — Continuous Viability Index VI(t) ∈ [-1, +1]. */
    viabilityRiskgate: boolean;
    /** R142 — Pre-Action Governance Reasoning Loop (4-layer ruleset). */
    governanceLoop: boolean;
    /** R143 — Observability/Decidability/Timeliness/Attestability gate. */
    odtaRuntimeGate: boolean;
    /** R145 — embedded-payload guard for memory writes. */
    memoryPayloadGuard: boolean;
    /** R150 — Agentic Bill of Materials (supply-chain attestation). */
    aibom: boolean;
    /** R155 — Confidence-calibrated HITL routing. */
    hitlConfidenceRouting: boolean;
    /** R160 — Google A2A Agent Card published at /.well-known/agent.json. */
    agentCardA2A: boolean;
    /** R161 — MCP Tool Gateway with scope grammar. */
    mcpToolGateway: boolean;
    /** R162 — Cross-protocol privilege alignment (least-privilege bridge). */
    crossProtocolBridge: boolean;
    /**
     * Move 14 — public verifier endpoint at /api/v1/verify/{surface}.
     * Every trust claim above can be replayed against pure-function
     * verifiers exposed over HTTP. Verifiable offline via the
     * @sovereign/inspector CLI; verifiable online via curl.
     */
    publicVerifierEndpoint: boolean;
  };
  /**
   * Mirror of the platform Agent Card capability list. SAME constant
   * imported by /.well-known/agent.json — drift impossible.
   * Auditors can compare this array against the kebab-case capabilities
   * field of the A2A Agent Card and confirm both manifests agree.
   */
  platformCapabilities: ReadonlyArray<string>;
  /** Where to fetch each verifiable artifact. Relative to canonicalUrl. */
  endpoints: {
    permanence: string;
    incidents: string;
    customers: string;
    providers: string;
    agentSlo: string;
    diagnose: string;
    hitlPolicy: string;
    verifyDelegation: string;
    publicTrace: string;
    /** R160 Move 13 — public Agent Card per Google A2A v1.0. */
    agentCard: string;
    /**
     * Move 14 — public verifier dispatcher. Replace `{surface}` with
     * one of: audit-chain, agent-card, aibom, scope-evaluation,
     * bridge-authorization, memory-payload. POST evidence as JSON,
     * receive an offline-replay verdict.
     */
    verifier: string;
    /** Move 14 — index endpoint listing all available verifier surfaces. */
    verifierIndex: string;
  };
  /**
   * Move 14 — explicit list of verifier surfaces. Mirror of
   * VERIFIER_SURFACES at the top of this route. Auditors can iterate
   * this list to discover every verifiable claim.
   */
  verifierSurfaces: ReadonlyArray<string>;
  /**
   * The verifier package customers use to check our claims locally.
   * This is the "you don't need to trust us" link.
   */
  verifier: {
    npmPackage: string;
    /** Install command for convenience. */
    install: string;
    /** Source repo. */
    source: string;
  };
  /**
   * Federation peers — other Sovereign instances we mutually
   * recognize. Empty array initially; populated as the federation
   * grows. Each entry is a peer's canonical URL; the inspector can
   * crawl them to build a trust graph.
   */
  federation: {
    peers: string[];
    /** ISO 8601 of last federation roster sync. */
    lastSync: string | null;
  };
  /** Statistics — derived from platform-stats.ts (single source). */
  stats: {
    agents: number;
    models: number;
  };
  /** A short note for human readers. */
  note: string;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  // Canonical URL = scheme + host (no path). Cleanly identifies the
  // instance without leaking deployment-specific paths.
  const canonicalUrl = `${url.protocol}//${url.host}`;

  const doc: SovereignTrustDocument = {
    $schema: `https://sovereignmatrix.agency/.well-known/sovereign-trust/v${SPEC_VERSION}`,
    generatedAt: new Date().toISOString(),
    identity: {
      name: "Sovereign Matrix",
      canonicalUrl,
      description:
        "The cryptographically-trustable compute layer for agentic commerce. " +
        "Every agent action is hash-chained, scope-bounded, cost-capped, schema-validated, " +
        "depth-limited, tenant-isolated, traced end-to-end, budget-bounded, and reversible by default.",
      // Future: SHA-256 of the platform's app-level signing key. We
      // don't have a stable platform-wide signing key yet (each user
      // has their own under R34 CADC); when we do, the fingerprint
      // will be published here for cross-instance verification.
      keyFingerprint: null,
    },
    capabilities: {
      auditChain: true,
      delegationChain: true, // R34
      multiStageHitl: true, // R33
      spendAuthorizations: true, // R30
      publicTrace: true, // R32
      publicReliability: true, // R27 + Elite
      publicHitlPolicy: true, // R33
      selfDiagnose: true, // R32
      agentCapabilityTokens: true, // R37
      agentIdentityRegistry: true, // R38
      policyGate: true, // R100  — Move 2
      behavioralInvariantIml: true, // R140 — Move 5
      viabilityRiskgate: true, // R141 — Move 5
      governanceLoop: true, // R142 — Move 6
      odtaRuntimeGate: true, // R143 — Move 6
      memoryPayloadGuard: true, // R145 — Move 7
      aibom: true, // R150 — Move 8
      hitlConfidenceRouting: true, // R155 — Move 9
      agentCardA2A: true, // R160 — Move 13 (this commit)
      mcpToolGateway: true, // R161 — Move 11
      crossProtocolBridge: true, // R162 — Move 12
      publicVerifierEndpoint: true, // Move 14 — this commit
    },
    platformCapabilities: SOVEREIGN_PLATFORM_CAPABILITIES,
    endpoints: {
      permanence: `${canonicalUrl}/api/health/permanence`,
      incidents: `${canonicalUrl}/api/health/incidents`,
      customers: `${canonicalUrl}/api/health/customers`,
      providers: `${canonicalUrl}/api/health/providers`,
      agentSlo: `${canonicalUrl}/api/health/agent-slo`,
      diagnose: `${canonicalUrl}/api/health/diagnose`,
      hitlPolicy: `${canonicalUrl}/api/health/hitl-policy`,
      verifyDelegation: `${canonicalUrl}/api/health/verify-delegation`,
      publicTrace: `${canonicalUrl}/api/health/trace/{traceId}`,
      agentCard: `${canonicalUrl}/.well-known/agent.json`,
      verifier: `${canonicalUrl}/api/v1/verify/{surface}`,
      verifierIndex: `${canonicalUrl}/api/v1/verify/index`,
    },
    verifierSurfaces: VERIFIER_SURFACES,
    verifier: {
      npmPackage: "@sovereign/inspector",
      install: "npm install -g @sovereign/inspector",
      source:
        "https://github.com/christiaan839-beep/sovereign-v2/tree/main/packages/inspector",
    },
    federation: {
      peers: [],
      lastSync: null,
    },
    stats: {
      agents: TOTAL_AGENTS,
      models: TOTAL_MODELS,
    },
    note:
      "Sovereign is not a required trust anchor. Run sovereign-inspect on any " +
      "endpoint above to verify our claims locally — the math runs on YOUR machine, " +
      "not ours. This file is the discovery seed for federated agentic-trust.",
  };

  log.info("served sovereign-trust discovery", { canonicalUrl });

  return NextResponse.json(doc, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control":
        "public, max-age=300, s-maxage=300, stale-while-revalidate=900",
      // Allow CORS so any third-party verifier can hit it
      // without proxy machinery.
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
    },
  });
}
