/**
 * POST /api/admin/agents/[slug]/reject
 *
 * Pulls a pending submission from the queue by setting
 * visibility='private'. The row stays in agent_metadata for audit —
 * we don't hard-delete, so the rejected author can see a rejection
 * (and ops can review the history).
 *
 * Admin-gated. Idempotent: rejecting an already-private row returns
 * 200 with the current state.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { agentMetadata } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-agent-reject");

interface Ctx {
  params: Promise<{ slug: string }>;
}

export async function POST(_req: Request, { params }: Ctx): Promise<Response> {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  const { slug } = await params;

  const updated = await db
    .update(agentMetadata)
    .set({
      visibility: "private",
      verified: false,
      updatedAt: new Date(),
    })
    .where(eq(agentMetadata.slug, slug))
    .returning({
      slug: agentMetadata.slug,
      displayName: agentMetadata.displayName,
      visibility: agentMetadata.visibility,
    });

  if (updated.length === 0) {
    return NextResponse.json(
      { error: "Agent not found" },
      { status: 404 },
    );
  }

  log.info("agent rejected", { slug, adminId: gate.userId });
  return NextResponse.json({ ok: true, agent: updated[0] });
}
