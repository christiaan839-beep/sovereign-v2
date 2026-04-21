/**
 * POST   /api/catalog/[slug]/install — install an agent for the signed-in user.
 * DELETE /api/catalog/[slug]/install — uninstall.
 *
 * Install is idempotent via a unique index on (user_id, agent_slug):
 * onConflictDoNothing returns 200 on retry instead of 409 duplicate-error.
 *
 * Credit gating (paid agents):
 *   At install time we verify balance >= pricingCents so users get an
 *   honest 402 instead of silently installing something they can't run.
 *   The actual deduction happens inside per-run credit holds (Plan 1) —
 *   installing does NOT charge anything. This keeps installs reversible.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { agentInstalls } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getAgentPublic } from "@/lib/agent-catalog";
import { getBalance } from "@/lib/credits";

type RouteCtx = { params: Promise<{ slug: string }> };

export async function POST(_req: Request, { params }: RouteCtx) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;

  const agent = await getAgentPublic(slug);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Paid agents — check balance upfront. Returning 402 Payment Required
  // gives the UI a clear signal to nudge toward top-up.
  if (agent.pricingCents > 0) {
    const balance = await getBalance(userId);
    if (balance < agent.pricingCents) {
      return NextResponse.json(
        {
          error: "Insufficient credits",
          required: agent.pricingCents,
          available: balance,
          topUpUrl: "/dashboard/billing?topup=true",
        },
        { status: 402 },
      );
    }
  }

  // Idempotent — unique (user_id, agent_slug) index makes the 2nd call a no-op.
  await db
    .insert(agentInstalls)
    .values({ userId, agentSlug: slug })
    .onConflictDoNothing();

  return NextResponse.json({ installed: true });
}

export async function DELETE(_req: Request, { params }: RouteCtx) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;

  await db
    .delete(agentInstalls)
    .where(and(eq(agentInstalls.userId, userId), eq(agentInstalls.agentSlug, slug)));

  // Always 200 — uninstalling something you don't have is effectively a no-op
  // and the client shouldn't see an error for it.
  return NextResponse.json({ uninstalled: true });
}
