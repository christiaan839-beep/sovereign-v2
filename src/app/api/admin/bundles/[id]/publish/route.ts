/**
 * POST /api/admin/bundles/[id]/publish   — flip a bundle from draft to public
 *
 * Idempotent: publishing an already-public bundle is a no-op (200).
 */

import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { agentBundles } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-bundle-publish");

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, ctx: Ctx): Promise<Response> {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "id_required" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await db
      .update(agentBundles)
      .set({
        isPublic: true,
        publishedAt: sql`COALESCE(${agentBundles.publishedAt}, NOW())`,
        updatedAt: sql`NOW()`,
      })
      .where(eq(agentBundles.id, id))
      .returning({
        id: agentBundles.id,
        slug: agentBundles.slug,
        isPublic: agentBundles.isPublic,
      });

    if (result.length === 0) {
      return NextResponse.json(
        { ok: false, error: "not_found" },
        { status: 404, headers: { "Cache-Control": "no-store" } },
      );
    }

    log.info("Admin published bundle", {
      bundleId: id,
      adminUserId: gate.userId,
    });

    return NextResponse.json(
      {
        ok: true,
        id: result[0].id,
        slug: result[0].slug,
        publicUrl: `/marketplace/bundles/${result[0].slug}`,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    log.error("publish bundle failed", {
      id,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { ok: false, error: "update_failed" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
