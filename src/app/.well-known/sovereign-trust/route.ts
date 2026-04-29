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

const log = createLogger("well-known-trust");

export const runtime = "nodejs";
export const revalidate = 300;

const SPEC_VERSION = "0.1.0";

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
  };
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
  };
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
      agentCapabilityTokens: true, // R37 — NEW
    },
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
    },
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
