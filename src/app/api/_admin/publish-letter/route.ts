import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import { db } from "@/db";
import { fridayLetters } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-publish-letter");

/**
 * POST /api/_admin/publish-letter
 *
 * Operator-only. Creates or updates a Friday Letter in the
 * `friday_letters` table and bumps the cache so the new letter
 * appears at /letters and /letters/[slug] immediately.
 *
 * Body:
 *   - slug         kebab-case URL slug (must not collide unless updating)
 *   - date         YYYY-MM-DD, must be a Friday for status="published"
 *   - title        single-line string
 *   - preview      2-3 sentences shown on the index list
 *   - body         full body, paragraphs separated by blank lines
 *   - status       "draft" | "published" — drafts don't surface publicly
 *   - id           (optional) UUID of an existing letter to update
 *
 * Behaviour:
 *   - Insert when `id` is absent or no row matches; update otherwise
 *   - On status="published", stamp publishedAt = now()
 *   - On slug collision (different id), return 409
 *   - On migration missing (42P01 / 42703), return 503 with the
 *     "apply MIGRATIONS-RUNME.sql" hint
 *   - On any other DB error, log + return 500
 */

const publishSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z
    .string()
    .min(3)
    .max(120)
    .regex(
      /^[a-z0-9-]+$/,
      "Use kebab-case: lowercase letters, digits, hyphens",
    ),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    // Regex alone permits impossible dates like 2026-13-45 — they
    // pass syntactically but `new Date(...)` returns NaN downstream
    // and the Friday-check fails with a misleading "must be a
    // Friday" error. Refining catches the bad input at the schema
    // boundary so the operator gets a clear validation message.
    .refine(
      (d) => !Number.isNaN(new Date(d + "T00:00:00Z").getTime()),
      "Date is not a valid calendar date",
    ),
  title: z.string().min(1).max(200),
  preview: z.string().min(1).max(500),
  body: z.string().min(50).max(50_000),
  status: z.enum(["draft", "published"]),
});

function isFriday(yyyyMmDd: string): boolean {
  const d = new Date(yyyyMmDd + "T00:00:00Z");
  return d.getUTCDay() === 5;
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = publishSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const data = parsed.data;
  if (data.status === "published" && !isFriday(data.date)) {
    return NextResponse.json(
      {
        error:
          "Published letters must be dated on a Friday — STANDARDS.md §06. Save as draft instead.",
      },
      { status: 422 },
    );
  }

  try {
    if (data.id) {
      const [updated] = await db
        .update(fridayLetters)
        .set({
          slug: data.slug,
          date: data.date,
          title: data.title,
          preview: data.preview,
          body: data.body,
          status: data.status,
          publishedAt: data.status === "published" ? sql`now()` : null,
          updatedAt: sql`now()`,
          authorUserId: gate.userId,
        })
        .where(eq(fridayLetters.id, data.id))
        .returning({ id: fridayLetters.id, slug: fridayLetters.slug });
      if (!updated) {
        return NextResponse.json(
          { error: "Letter not found" },
          { status: 404 },
        );
      }
      bumpCache(updated.slug);
      log.info("Letter updated", {
        id: updated.id,
        slug: updated.slug,
        status: data.status,
        adminUserId: gate.userId,
      });
      return NextResponse.json({
        ok: true,
        id: updated.id,
        slug: updated.slug,
      });
    }

    const [inserted] = await db
      .insert(fridayLetters)
      .values({
        slug: data.slug,
        date: data.date,
        title: data.title,
        preview: data.preview,
        body: data.body,
        status: data.status,
        publishedAt: data.status === "published" ? sql`now()` : null,
        authorUserId: gate.userId,
      })
      .returning({ id: fridayLetters.id, slug: fridayLetters.slug });

    bumpCache(inserted.slug);
    log.info("Letter created", {
      id: inserted.id,
      slug: inserted.slug,
      status: data.status,
      adminUserId: gate.userId,
    });
    return NextResponse.json({
      ok: true,
      id: inserted.id,
      slug: inserted.slug,
    });
  } catch (err) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "23505") {
      return NextResponse.json(
        { error: `Slug "${data.slug}" is already in use.` },
        { status: 409 },
      );
    }
    if (pgCode === "42P01" || pgCode === "42703") {
      return NextResponse.json(
        {
          error:
            "Database migration 0022 is not applied. Paste MIGRATIONS-RUNME.sql into Neon Console and try again.",
        },
        { status: 503 },
      );
    }
    log.error("Publish-letter failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

function bumpCache(slug: string) {
  try {
    revalidatePath("/letters");
    revalidatePath(`/letters/${slug}`);
  } catch {
    // revalidatePath fails noisily in some test environments; ignore.
  }
}
