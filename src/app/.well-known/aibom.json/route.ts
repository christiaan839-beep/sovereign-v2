/**
 * GET /.well-known/aibom.json
 *
 * Move 20. Public Sovereign Matrix platform-level Agentic Bill of
 * Materials (R150 AIBOM). Lists every model, tool, and agent the
 * platform composes — with SHA-256 fingerprints over identity fields
 * so any auditor can validate the document offline.
 *
 *   curl https://sovereignmatrix.agency/.well-known/aibom.json | \
 *     sovereign-inspect verify-aibom
 *
 * STANDARD-SETTING POSTURE
 *
 *   - Discovery via the canonical /.well-known/ namespace per RFC 8615.
 *   - Document hash anchors the entire AIBOM (any tampering breaks it).
 *   - Component fingerprints anchor each model/tool/agent individually.
 *   - SPDX 3.1-style relationship kinds (INVOKES, DEPENDS_ON, etc.).
 *   - Open spec (Sovereign Trust Manifest 1.0 §3 lists `aibom`
 *     capability) — any vendor can publish a compatible doc.
 *
 * COMPLIANCE FRAMING
 *
 *   - OWASP ASI04 (Agentic Supply Chain Vulnerabilities) — closes
 *     the supply-chain attestation gap that the OWASP Top 10 calls
 *     out as the most-overlooked vector for agentic AI.
 *   - EU AI Act Art. 13 (transparency) + Annex IV (technical docs).
 *   - SOC 2 CC2.3 (information communication).
 *
 * CACHE
 *
 *   1 hour. The platform AIBOM only changes on deploy.
 */

import { NextResponse } from "next/server";
import { AGENT_MANIFESTS } from "@/lib/agent-manifests.generated";
import { buildPlatformAIBOM } from "@/lib/aibom-builder";
import { buildAIBOMAuditEntry } from "@/lib/supply-chain/aibom";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";

const log = createLogger("well-known-aibom");

export const runtime = "nodejs";
export const revalidate = 3600;

// Stable platform version for fingerprint determinism per deploy.
// Falls back to a deploy-stable string when neither env var is set.
const PLATFORM_VERSION =
  process.env.AGENT_CARD_PUBLISHED_AT ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  "dev";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

// Audit-fire guard: emit `agent.sbom_generated` once per process boot.
// Prevents the cron + 1-hour revalidate from spamming the chain.
let auditFiredForVersion: string | null = null;

export async function GET() {
  const generatedAt = new Date().toISOString();
  const doc = buildPlatformAIBOM({
    agentManifests: AGENT_MANIFESTS,
    platformVersion: PLATFORM_VERSION,
    generatedAt,
  });

  // R150 audit-action firing site. Forward-declared in audit-log.ts.
  if (auditFiredForVersion !== PLATFORM_VERSION) {
    const entry = buildAIBOMAuditEntry(doc);
    auditLog({
      userId: "system-aibom",
      action: entry.action,
      resource: entry.resource,
      details: entry.details,
    }).catch(() => {});
    auditFiredForVersion = PLATFORM_VERSION;
    log.info("AIBOM published", {
      documentHash: doc.documentHash,
      componentCount: doc.components.length,
      relationshipCount: doc.relationships.length,
    });
  }

  return NextResponse.json(doc, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control":
        "public, max-age=3600, s-maxage=3600, stale-while-revalidate=10800",
      "X-Sovereign-AIBOM-Hash": doc.documentHash,
      ...corsHeaders,
    },
  });
}
