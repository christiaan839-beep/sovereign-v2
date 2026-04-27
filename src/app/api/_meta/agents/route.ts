/**
 * GET /api/_meta/agents.json — Per-agent capability manifest.
 *
 * Companion to /api/_meta/transparency.json. Where transparency.json
 * is the platform-level claim surface, agents.json is the AGENT-level
 * claim surface — every registered agent's capability profile in one
 * machine-readable response.
 *
 * Maps to OWASP LLM Top 10 (2025):
 *   - LLM05 Supply Chain    — `models[]` per agent (per-agent SBOM)
 *   - LLM06 Sensitive Info  — `pii.guardMode` per agent
 *   - LLM07 Insecure Plugin — `tools[]` per agent (3rd-party SDK calls)
 *   - LLM08 Excessive Agency— `tier` (1 autonomous, 2 confirm, 3 admin)
 *   - LLM10 Model Theft     — `outputClass` (public / tenant / confidential)
 *
 * Auditor LLMs (FMTI, EU AI Act, NIST AI RMF, MITRE ATLAS) can verify:
 *   - Which providers each agent talks to
 *   - Which agents perform side effects (writes, network egress)
 *   - Which agents need user/admin confirmation before execute
 *   - The static-analyzer confidence per agent (low confidence =
 *     manual review recommended)
 *   - Where manual overrides correct under-classified agents
 *
 * SCHEMA STABILITY: top-level shape is versioned via `schemaVersion`.
 * Field deletions bump the major version + keep the previous version
 * reachable at /api/_meta/agents/v1 for ≥90 days.
 *
 * Cache: 1 hour at the edge. Refreshes on each deploy.
 *
 * NO PII — all per-agent metadata. Safe to share unauthenticated.
 */

import { NextResponse } from "next/server";
import { AGENT_MANIFESTS, AGENT_MANIFEST_COUNT } from "@/lib/agent-manifests.generated";
import {
  AGENT_MANIFEST_OVERRIDES,
  applyOverride,
  getAgentOverride,
} from "@/lib/agent-manifest-overrides";
import type { AgentManifest } from "@/lib/agent-manifest";

export const runtime = "nodejs";
export const revalidate = 3600;

interface AgentsManifestResponse {
  schemaVersion: "1.0";
  generatedAt: string;
  canonicalUrl: string;
  count: number;
  source: {
    static: string;
    overrides: string;
  };
  tierDistribution: {
    "1-autonomous": number;
    "2-confirm": number;
    "3-admin-approval": number;
  };
  manualOverrides: Array<{
    slug: string;
    reason: string;
    tier?: number;
  }>;
  lowConfidenceAgents: string[];
  agents: Record<string, AgentManifest>;
}

export async function GET(): Promise<NextResponse> {
  const merged: Record<string, AgentManifest> = {};
  const tierCount = { 1: 0, 2: 0, 3: 0 };
  const lowConfidence: string[] = [];

  for (const [slug, generated] of Object.entries(AGENT_MANIFESTS)) {
    const override = getAgentOverride(slug);
    const final = applyOverride(generated, override);
    merged[slug] = final;
    tierCount[final.tier] = (tierCount[final.tier] ?? 0) + 1;
    if (final.classifierConfidence < 0.6 && !override) {
      // Low-confidence + no override = candidate for manual review.
      lowConfidence.push(slug);
    }
  }

  const body: AgentsManifestResponse = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    canonicalUrl: "https://sovereignmatrix.agency/api/_meta/agents.json",
    count: AGENT_MANIFEST_COUNT,
    source: {
      static: "scripts/analyze-agent-manifests.mjs (auto, on every build)",
      overrides: "src/lib/agent-manifest-overrides.ts (manual + audited)",
    },
    tierDistribution: {
      "1-autonomous": tierCount[1] ?? 0,
      "2-confirm": tierCount[2] ?? 0,
      "3-admin-approval": tierCount[3] ?? 0,
    },
    manualOverrides: AGENT_MANIFEST_OVERRIDES.map((o) => ({
      slug: o.slug,
      reason: o.reason,
      ...(o.tier !== undefined ? { tier: o.tier } : {}),
    })),
    lowConfidenceAgents: lowConfidence,
    agents: merged,
  };

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "X-Sovereign-Manifest-Schema": "1.0",
      "X-Sovereign-Manifest-Audience": "human, ai-agent",
    },
  });
}
