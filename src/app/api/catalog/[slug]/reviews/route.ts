/**
 * GET  /api/catalog/[slug]/reviews — public, sorted by createdAt desc, limit 20.
 * POST /api/catalog/[slug]/reviews — Clerk-required, upserts one review
 *                                     per (userId, slug).
 *
 * Invariants enforced by the DB (unique index on user_id + agent_slug):
 *   - One review per user per agent. POST is always an upsert, never a
 *     duplicate — second POST updates rating/comment in place.
 *
 * Invariants enforced here (Zod):
 *   - rating ∈ [1, 5] integer
 *   - comment ≤ 2000 chars (null allowed)
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/db";
import { agentReviews } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getAgentPublic } from "@/lib/agent-catalog";

type RouteCtx = { params: Promise<{ slug: string }> };

const REVIEW_PAGE_SIZE = 20;

export async function GET(_req: Request, { params }: RouteCtx) {
  const { slug } = await params;

  const reviews = await db
    .select({
      id: agentReviews.id,
      userId: agentReviews.userId,
      rating: agentReviews.rating,
      comment: agentReviews.comment,
      createdAt: agentReviews.createdAt,
      updatedAt: agentReviews.updatedAt,
    })
    .from(agentReviews)
    .where(eq(agentReviews.agentSlug, slug))
    .orderBy(desc(agentReviews.createdAt))
    .limit(REVIEW_PAGE_SIZE);

  return NextResponse.json(
    { reviews },
    { headers: { "Cache-Control": "public, max-age=15, s-maxage=30" } },
  );
}

const ReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).nullable().optional(),
});

export async function POST(req: Request, { params }: RouteCtx) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { slug } = await params;

  // Reject URLs that don't correspond to real agents (prevents review spam on
  // slugs that 404 everywhere else).
  const agent = await getAgentPublic(slug);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = ReviewSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { rating, comment } = parsed.data;

  // Upsert — unique index on (user_id, agent_slug) makes DO UPDATE the right
  // shape: one row per user per agent, edits overwrite.
  const [review] = await db
    .insert(agentReviews)
    .values({
      userId,
      agentSlug: slug,
      rating,
      comment: comment ?? null,
    })
    .onConflictDoUpdate({
      target: [agentReviews.userId, agentReviews.agentSlug],
      set: {
        rating,
        comment: comment ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  return NextResponse.json({ review });
}
