/**
 * SOVEREIGN MATRIX — /api/marketplace/listings (Cook 70 API)
 *
 * Lists + creates marketplace listings backed by the Cook 62 core.
 *
 * POST  → create new listing in `submitted` state owned by the caller.
 * GET   → list every listing the caller owns + every published listing.
 *
 * Persistence is in `src/lib/marketplace-store.ts` (in-memory until
 * migration 0021 lands).
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { createLogger } from "@/lib/logger";
import { auditLog } from "@/lib/audit-log";
import {
  transition,
  validateListing,
  type MarketplaceListing,
  type SafetyLayer,
} from "@/lib/marketplace-core";
import { findBySlug, listAll, put } from "@/lib/marketplace-store";
import { z } from "zod";
import { randomUUID } from "crypto";

const log = createLogger("marketplace/listings");

export const dynamic = "force-dynamic";

const POST_SCHEMA = z.object({
  slug: z.string().min(2).max(64),
  displayName: z.string().min(1).max(80),
  description: z.string().max(280).default(""),
  pricePerRunCents: z.number().int().min(0).max(100_000_000),
  safetyLayers: z
    .array(
      z.enum([
        "jailbreak",
        "content-safety",
        "pii",
        "quality",
        "critic",
        "hallucination",
      ]),
    )
    .min(1),
});

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId || "";
  const items = listAll().filter(
    (l) => l.developerId === userId || l.status === "published",
  );
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const userId = auth.userId || "";

  try {
    const body = await req.json();
    const parsed = POST_SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    if (findBySlug(parsed.data.slug)) {
      return NextResponse.json(
        { error: "Slug already taken" },
        { status: 409 },
      );
    }

    const listing: MarketplaceListing = {
      slug: parsed.data.slug,
      developerId: userId,
      displayName: parsed.data.displayName,
      description: parsed.data.description,
      pricePerRunCents: parsed.data.pricePerRunCents,
      status: "draft",
      safetyLayers: parsed.data.safetyLayers as SafetyLayer[],
    };

    const validation = validateListing(listing);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.reason }, { status: 400 });
    }

    const submit = transition(listing, "submitted");
    if (!submit.ok || !submit.listing) {
      return NextResponse.json(
        { error: submit.details ?? "transition failed" },
        { status: 400 },
      );
    }

    const id = randomUUID();
    put({ ...submit.listing, id });

    await auditLog({
      userId,
      action: "marketplace.submit",
      resource: `listing:${id}`,
      details: { slug: parsed.data.slug },
    });

    return NextResponse.json({ id, listing: submit.listing }, { status: 201 });
  } catch (err) {
    log.error(
      "POST /api/marketplace/listings failed",
      err as Record<string, unknown>,
    );
    return NextResponse.json(
      { error: "Failed to create listing" },
      { status: 500 },
    );
  }
}
