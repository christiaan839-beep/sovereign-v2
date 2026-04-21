/**
 * POST /api/admin/agents/[slug]/approve
 *
 * Promotes a pending submission to public + verified.
 *
 * Admin-gated. 404 if the slug isn't in agent_metadata, 200 otherwise
 * (idempotent — approving an already-public agent is a no-op).
 *
 * Body (optional): { verified: boolean } — defaults to true. Set to
 * false to publish without the verification checkmark.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { agentMetadata } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-agent-approve");

interface Ctx {
  params: Promise<{ slug: string }>;
}

export async function POST(req: Request, { params }: Ctx): Promise<Response> {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  const { slug } = await params;

  // Optional body — default verified=true.
  let verified = true;
  try {
    const raw = await req.text();
    if (raw.trim()) {
      const parsed = JSON.parse(raw) as { verified?: unknown };
      if (typeof parsed.verified === "boolean") verified = parsed.verified;
    }
  } catch {
    /* body is optional — any parse error falls back to default */
  }

  const updated = await db
    .update(agentMetadata)
    .set({
      visibility: "public",
      verified,
      updatedAt: new Date(),
    })
    .where(eq(agentMetadata.slug, slug))
    .returning({
      slug: agentMetadata.slug,
      displayName: agentMetadata.displayName,
      visibility: agentMetadata.visibility,
      verified: agentMetadata.verified,
    });

  if (updated.length === 0) {
    return NextResponse.json(
      { error: "Agent not found" },
      { status: 404 },
    );
  }

  log.info("agent approved", { slug, adminId: gate.userId, verified });
  return NextResponse.json({ ok: true, agent: updated[0] });
}
