/**
 * /marketplace/[agentId] — server-component shell.
 *
 * Two lookup paths:
 *
 *   1. DB by slug (SAM v1.0 submissions via /api/creators/submit)
 *   2. Fallback to the hardcoded-content client component (legacy —
 *      lead-blitz, content-machine, competitor-takedown)
 *
 * This means /marketplace/extract-invoice works for a SAM submission
 * without disturbing /marketplace/lead-blitz, which continues to be
 * served by the existing curated copy. When the hardcoded agents are
 * eventually imported into the DB, the client fallback can be removed
 * entirely and this becomes a pure server component.
 *
 * generateMetadata hooks into the DB path too, so SAM agents get real
 * <title> + <description> for link previews and SEO.
 */

import type { Metadata } from "next";
import { fetchPublishedAgentBySlug } from "@/lib/marketplace-query";
import { AgentDetailClient } from "./AgentDetailClient";
import { SamAgentDetail } from "./SamAgentDetail";

interface RouteParams {
  params: Promise<{ agentId: string }>;
}

export async function generateMetadata({ params }: RouteParams): Promise<Metadata> {
  const { agentId } = await params;
  const agent = await fetchPublishedAgentBySlug(agentId);
  if (agent) {
    return {
      title: `${agent.name} — Sovereign Marketplace`,
      description: agent.description,
      openGraph: {
        title: agent.name,
        description: agent.description,
        type: "article",
      },
      twitter: {
        card: "summary_large_image",
        title: agent.name,
        description: agent.description,
      },
    };
  }
  // Fallback metadata for hardcoded or unknown agents.
  return {
    title: "Agent — Sovereign Marketplace",
  };
}

export default async function Page({ params }: RouteParams) {
  const { agentId } = await params;
  const agent = await fetchPublishedAgentBySlug(agentId);
  if (agent) {
    return <SamAgentDetail agent={agent} />;
  }
  // Fall through to the hardcoded client component. It handles its
  // own "not found" state internally by falling back to a default.
  return <AgentDetailClient />;
}
