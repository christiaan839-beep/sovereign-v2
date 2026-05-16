/**
 * SOVEREIGN MATRIX — /api/marketplace/listings/[slug] (Cook 70 admin).
 *
 * Admin-only state transitions on a marketplace listing. The dynamic
 * segment is named `slug` to share the parent with `/[slug]/run` —
 * Next.js requires a single param name across siblings at the same
 * path. The store key is still the listing's stable identifier; it's
 * carried through under the `slug` field on params.
 *
 * PATCH { target: "approved" | "rejected" | "published" | "unpublished" }
 *   → admin-only via isAdmin(). Caller of /marketplace/admin uses this
 *     to move listings through the Cook 62 state machine.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { isAdmin } from "@/lib/admin-auth";
import { transition } from "@/lib/marketplace-core";
import { get, put } from "@/lib/marketplace-store";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";
import { z } from "zod";

const log = createLogger("marketplace/listings/[slug]");

const PATCH_SCHEMA = z.object({
  target: z.enum([
    "approved",
    "rejected",
    "published",
    "unpublished",
    "draft",
    "submitted",
  ]),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  if (!isAdmin(auth.userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { slug: id } = await params;
  const listing = get(id);
  if (!listing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const parsed = PATCH_SCHEMA.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const result = transition(listing, parsed.data.target);
    if (!result.ok || !result.listing) {
      return NextResponse.json(
        { error: result.details ?? result.reason ?? "transition failed" },
        { status: 400 },
      );
    }

    put({ ...result.listing, id });

    await auditLog({
      userId: auth.userId,
      action: `marketplace.${parsed.data.target}`,
      resource: `listing:${id}`,
      details: { by: auth.userId },
    });

    return NextResponse.json({ ok: true, listing: result.listing });
  } catch (err) {
    log.error(
      "PATCH /api/marketplace/listings/[slug] failed",
      err as Record<string, unknown>,
    );
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { slug: id } = await params;
  const listing = get(id);
  if (!listing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Owner or published listings are visible to anyone authed; otherwise admin only.
  if (
    listing.developerId !== auth.userId &&
    listing.status !== "published" &&
    !isAdmin(auth.userId)
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ listing });
}
