/**
 * GET /api/case-studies/[slug] — single published case study detail.
 *
 * Returns the full markdown body. Used by /case-studies/[slug] page to
 * server-render the long-form narrative. 404 for any slug that isn't
 * approved + published.
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { caseStudies } from "@/db/schema";
import { and, eq, isNotNull } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("case-study-detail-api");

export const revalidate = 300;

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_req: Request, { params }: RouteContext) {
  const { slug } = await params;
  if (!slug || slug.length > 200) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  try {
    const [row] = await db
      .select()
      .from(caseStudies)
      .where(
        and(
          eq(caseStudies.slug, slug),
          eq(caseStudies.approvedByCompany, true),
          isNotNull(caseStudies.publishedAt),
        ),
      )
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(
      { caseStudy: row },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
        },
      },
    );
  } catch (err: unknown) {
    const pgCode = (err as { code?: string })?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (pgCode === "42P01" || msg.includes("does not exist")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    log.error("GET /api/case-studies/[slug] failed", { error: msg, slug });
    return NextResponse.json(
      { error: "Temporarily unavailable" },
      { status: 503 },
    );
  }
}
