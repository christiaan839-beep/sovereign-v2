/**
 * SOVEREIGN MATRIX — /api/marketplace/listings/[id] (Cook 70 admin).
 *
 * Admin-only state transitions on a marketplace listing.
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

const log = createLogger("marketplace/listings/[id]");

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
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  if (!isAdmin(auth.userId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;
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
      "PATCH /api/marketplace/listings/[id] failed",
      err as Record<string, unknown>,
    );
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  const { id } = await params;
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
