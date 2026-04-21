/**
 * POST /api/developers/submit — 3rd-party agent submission handler.
 *
 * Auth: Clerk required. Submitted agents are stamped with creatorUserId
 * so the admin review UI can attribute + audit.
 *
 * Behavior:
 *   - Validates via agent-submission.ts (Zod + screening)
 *   - Inserts into agent_metadata with visibility='unlisted' +
 *     verified=false + published=true. They show up on /world and
 *     /agents/[slug] for the author, but stay off the public catalog
 *     feeds until an admin flips visibility='public'.
 *   - Slug collision → 409 Conflict with a clear message. We don't
 *     auto-suffix ("lead-finder-2") — that creates SEO churn when the
 *     author fixes the name and resubmits.
 */

import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { agentMetadata } from "@/db/schema";
import { eq } from "drizzle-orm";
import { validateSubmission } from "@/lib/agent-submission";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = validateSubmission(payload);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, issues: result.issues },
      { status: result.status },
    );
  }

  const { data, slug } = result;

  // Slug collision check
  const [existing] = await db
    .select({ slug: agentMetadata.slug })
    .from(agentMetadata)
    .where(eq(agentMetadata.slug, slug))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      {
        error: "Slug already taken",
        suggestion: `Try a more specific name — "${data.name}" would collide with /agents/${slug}`,
      },
      { status: 409 },
    );
  }

  // Best-effort creator handle — Clerk username or first public email
  let creatorHandle: string | null = null;
  try {
    const user = await currentUser();
    if (user) {
      creatorHandle =
        user.username ??
        user.primaryEmailAddress?.emailAddress?.split("@")[0] ??
        null;
    }
  } catch {
    // Clerk call failing shouldn't block the submission
  }

  const inserted = await db
    .insert(agentMetadata)
    .values({
      slug,
      displayName: data.name,
      tagline: data.tagline,
      description: data.description ?? null,
      category: data.category,
      creatorUserId: userId,
      creatorHandle,
      pricingCents: data.pricingCents,
      tags: [],
      featured: false,
      verified: false,
      published: true, // author can see it; visibility='unlisted' hides from public feeds
      visibility: "unlisted",
    })
    .returning();

  // If the insert somehow returned nothing (shouldn't happen — we
  // checked collision above) fail loudly.
  if (!inserted[0]) {
    return NextResponse.json(
      { error: "Submission failed — please retry" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    submitted: true,
    slug,
    previewUrl: `/agents/${slug}`,
    reviewStatus: "pending_review",
    message:
      "Your agent is live at its unlisted URL. An admin will review for promotion to public within 48 hours.",
  });
}
