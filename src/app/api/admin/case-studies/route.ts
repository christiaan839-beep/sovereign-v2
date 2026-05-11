/**
 * /api/admin/case-studies — admin CRUD for customer-wins library.
 *
 * GET   list everything (drafts + published)
 * POST  upsert a case study (admin only). Setting `publish: true` and
 *       `approvedByCompany: true` flips the row visible on /case-studies.
 *
 * Why an explicit admin route alongside the public GET?
 *   - Public GET filters to approved + published only.
 *   - Admin GET shows drafts so you can preview before flipping live.
 *   - POST is the operator's "paste a real customer outcome and ship it"
 *     surface — quicker than the agent for a one-off edit.
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { caseStudies } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-case-studies");

export const dynamic = "force-dynamic";

const upsertSchema = z.object({
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9][a-z0-9-]*$/u, "slug must be lowercase kebab-case"),
  company: z.string().min(1).max(200),
  industry: z.string().max(100).optional().nullable(),
  outcome: z.string().min(8).max(280),
  metric: z.string().min(1).max(80),
  playbook: z.string().min(1).max(80),
  body: z.string().max(20_000).optional().nullable(),
  approvedByCompany: z.boolean().optional(),
  publish: z.boolean().optional(),
});

export async function GET() {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  try {
    const rows = await db
      .select()
      .from(caseStudies)
      .orderBy(desc(caseStudies.updatedAt))
      .limit(200);
    return NextResponse.json({ count: rows.length, caseStudies: rows });
  } catch (err) {
    log.error("admin list failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Temporarily unavailable" },
      { status: 503 },
    );
  }
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const publishedAt = data.publish ? new Date() : null;

  try {
    // Idempotent upsert keyed on slug — admin can edit-and-republish in place.
    const [row] = await db
      .insert(caseStudies)
      .values({
        slug: data.slug,
        company: data.company,
        industry: data.industry ?? null,
        outcome: data.outcome,
        metric: data.metric,
        playbook: data.playbook,
        body: data.body ?? null,
        approvedByCompany: data.approvedByCompany ?? false,
        publishedAt,
      })
      .onConflictDoUpdate({
        target: caseStudies.slug,
        set: {
          company: data.company,
          industry: data.industry ?? null,
          outcome: data.outcome,
          metric: data.metric,
          playbook: data.playbook,
          body: data.body ?? null,
          approvedByCompany: data.approvedByCompany ?? false,
          publishedAt,
          updatedAt: new Date(),
        },
      })
      .returning();

    return NextResponse.json({ caseStudy: row }, { status: 200 });
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (pgCode === "42P01" || msg.includes("does not exist")) {
      return NextResponse.json(
        {
          error:
            "case_studies table missing — apply drizzle/0018_finishing_tables.sql",
        },
        { status: 503 },
      );
    }
    log.error("admin upsert failed", { error: msg, slug: data.slug });
    return NextResponse.json(
      { error: "Failed to save case study" },
      { status: 500 },
    );
  }
}

const deleteSchema = z.object({ slug: z.string().min(1).max(200) });

export async function DELETE(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  try {
    await db.delete(caseStudies).where(eq(caseStudies.slug, parsed.data.slug));
    return NextResponse.json({ deleted: true });
  } catch (err) {
    log.error("admin delete failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
