/**
 * DELETE /api/webhooks/subscriptions/[id]  — soft-delete a subscription
 *
 * Soft-delete via is_active=false. Keeps delivery history intact for
 * audit. A re-registered subscription with the same label gets a new
 * ID + new secret — by design.
 */

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { webhookSubscriptions } from "@/db/schema";
import { requireAuth } from "@/lib/auth-guard";
import { createLogger } from "@/lib/logger";

const log = createLogger("webhooks-subscription-delete");

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, ctx: Ctx): Promise<Response> {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "id_required" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    // Scope to the caller — users can only delete their own subscriptions.
    const result = await db
      .update(webhookSubscriptions)
      .set({ isActive: false })
      .where(
        and(
          eq(webhookSubscriptions.id, id),
          eq(webhookSubscriptions.ownerEmail, auth.email.toLowerCase()),
          eq(webhookSubscriptions.isActive, true),
        ),
      )
      .returning({ id: webhookSubscriptions.id });

    if (result.length === 0) {
      // Either the ID doesn't exist, isn't owned by this user, or is
      // already inactive. 404 for all three — don't leak which.
      return NextResponse.json(
        { ok: false, error: "not_found" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { ok: true, id: result[0].id },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    log.error("delete subscription failed", {
      id,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { ok: false, error: "delete_failed" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
