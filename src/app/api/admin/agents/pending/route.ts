/**
 * GET /api/admin/agents/pending — list unlisted/pending submissions.
 *
 * Admin-gated. Returns agents with visibility='unlisted' sorted by
 * createdAt desc, limited to 50. Used by /dashboard/admin/agents
 * to populate the moderation queue.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { agentMetadata } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export async function GET(): Promise<Response> {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  const rows = await db
    .select({
      slug: agentMetadata.slug,
      displayName: agentMetadata.displayName,
      tagline: agentMetadata.tagline,
      description: agentMetadata.description,
      category: agentMetadata.category,
      pricingCents: agentMetadata.pricingCents,
      creatorUserId: agentMetadata.creatorUserId,
      creatorHandle: agentMetadata.creatorHandle,
      verified: agentMetadata.verified,
      createdAt: agentMetadata.createdAt,
    })
    .from(agentMetadata)
    .where(eq(agentMetadata.visibility, "unlisted"))
    .orderBy(desc(agentMetadata.createdAt))
    .limit(50);

  return NextResponse.json(
    { agents: rows, total: rows.length },
    { headers: { "Cache-Control": "no-store" } },
  );
}
