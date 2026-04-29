/**
 * GET /api/control-plane/agents
 *
 * PUBLIC, machine-readable agent registry feed. Procurement teams,
 * auditors, ISVs, and competitors can fetch the full list of
 * registered agents + their capability surface.
 *
 * Query params:
 *   ?maxTier=1        — only Tier-1 (read-only) agents
 *   ?capabilities=a,b — filter to agents with these capabilities (comma-sep)
 *   ?slug=substring   — filter by slug substring
 *   ?stats=true       — return registry stats summary instead of list
 *
 * Cached 5 min — agent set changes only on a deploy.
 */

import { NextResponse } from "next/server";
import {
  listRegisteredAgents,
  registryStats,
  type AgentCapability,
  type RegistryFilter,
} from "@/lib/control-plane/agent-registry";
import type { AgentTier } from "@/lib/agent-manifest";

export const runtime = "nodejs";
export const revalidate = 300;

const VALID_CAPS = new Set<AgentCapability>([
  "read",
  "model_call",
  "external_fetch",
  "db_write",
  "file_write",
  "browser_control",
  "payment_op",
  "voice_call",
  "email_send",
  "image_gen",
  "audio_gen",
  "code_exec",
]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = url.searchParams;

  if (params.get("stats") === "true") {
    const stats = registryStats();
    return NextResponse.json(
      {
        stats,
        verifierNote:
          "Same pure function as @sovereign/inspector. Recompute locally " +
          "from the manifest map at packages/inspector/src/agent-registry.mjs.",
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  }

  const filter: RegistryFilter = {};

  const maxTierStr = params.get("maxTier");
  if (maxTierStr) {
    const t = Number.parseInt(maxTierStr, 10);
    if (t === 1 || t === 2 || t === 3) {
      filter.maxTier = t as AgentTier;
    }
  }

  const capsStr = params.get("capabilities");
  if (capsStr) {
    const caps = capsStr
      .split(",")
      .map((c) => c.trim())
      .filter((c) => VALID_CAPS.has(c as AgentCapability)) as AgentCapability[];
    if (caps.length > 0) filter.requiredCapabilities = caps;
  }

  const slug = params.get("slug");
  if (slug) filter.slugSubstring = slug;

  const agents = listRegisteredAgents(filter);
  // Slim the response — clients don't need the full manifest.
  const slim = agents.map((a) => ({
    slug: a.slug,
    tier: a.manifest.tier,
    tierReason: a.manifest.tierReason,
    outputClass: a.manifest.outputClass,
    piiGuardMode: a.manifest.pii.guardMode,
    capabilities: a.capabilities,
    classifierConfidence: a.manifest.classifierConfidence,
  }));

  return NextResponse.json(
    {
      total: slim.length,
      filter,
      agents: slim,
    },
    {
      status: 200,
      headers: {
        "Cache-Control":
          "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
