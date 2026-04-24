/**
 * GET  /api/admin/bundles       — list all bundles (public + private)
 * POST /api/admin/bundles       — create a bundle
 *
 * Auth: requireAdmin (Clerk + ADMIN_USER_IDS). Non-admins 404.
 *
 * Bundles created here start is_public=false. A separate POST to
 * /api/admin/bundles/[id]/publish flips is_public=true.
 */

import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { agentBundles } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { createBundle } from "@/lib/agent-bundles";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-bundles");

export async function GET(): Promise<Response> {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  try {
    const rows = await db
      .select()
      .from(agentBundles)
      .orderBy(desc(agentBundles.createdAt));
    return NextResponse.json(
      { ok: true, count: rows.length, bundles: rows },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    log.error("list bundles failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { ok: false, error: "query_failed" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

interface CreateBody {
  slug?: unknown;
  name?: unknown;
  description?: unknown;
  category?: unknown;
  priceCents?: unknown;
  creatorSharePct?: unknown;
  members?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "bad_json" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const category =
    typeof body.category === "string" ? body.category.trim() : "";
  const priceCents = typeof body.priceCents === "number" ? body.priceCents : 0;
  const creatorSharePct =
    typeof body.creatorSharePct === "number" ? body.creatorSharePct : 70;

  // Members come as [{ agentSlug, sharePct }]
  const members =
    Array.isArray(body.members)
      ? body.members
          .map((m) => {
            if (!m || typeof m !== "object") return null;
            const obj = m as Record<string, unknown>;
            if (
              typeof obj.agentSlug !== "string" ||
              typeof obj.sharePct !== "number"
            ) {
              return null;
            }
            return {
              agentSlug: obj.agentSlug.trim().toLowerCase(),
              sharePct: obj.sharePct,
            };
          })
          .filter((m): m is { agentSlug: string; sharePct: number } => m !== null)
      : [];

  // Inline field validation — return distinct codes for each field so
  // the UI can place the error in the right spot.
  if (!slug) {
    return NextResponse.json(
      { ok: false, error: "slug_required" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!name) {
    return NextResponse.json(
      { ok: false, error: "name_required" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!description) {
    return NextResponse.json(
      { ok: false, error: "description_required" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!category) {
    return NextResponse.json(
      { ok: false, error: "category_required" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (members.length < 2) {
    return NextResponse.json(
      { ok: false, error: "need_at_least_2_members" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Delegate to the library — validates shares sum to 100 +
  // verifies every agent slug exists + is verified.
  const result = await createBundle({
    slug,
    name,
    description,
    category,
    publisherEmail: "sovereignmatrix.agency", // platform-published
    priceCents,
    creatorSharePct,
    members,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.code ?? "create_failed",
        missingSlugs: result.missingSlugs,
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  log.info("Admin created bundle", {
    bundleId: result.id,
    slug,
    adminUserId: gate.userId,
  });

  return NextResponse.json(
    { ok: true, id: result.id, slug },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
