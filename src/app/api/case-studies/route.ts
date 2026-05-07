/**
 * GET /api/case-studies — public list of published customer wins.
 *
 * Reads from the `case_studies` table where:
 *   - approved_by_company = true  (the customer signed off — never publish without)
 *   - published_at IS NOT NULL    (intentionally published; drafts stay hidden)
 *
 * Powers the "Real customer wins" section on /case-studies and the
 * /showcase customer carousel. Cached at the edge with revalidate so we
 * don't pound the DB on every visit; bust on new approval.
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { caseStudies } from "@/db/schema";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("case-studies-api");

// 5-minute ISR. New customer wins ship within 5 min of approval — fast
// enough for a marketing surface, slow enough to absorb burst traffic.
export const revalidate = 300;

export async function GET() {
  try {
    const rows = await db
      .select({
        slug: caseStudies.slug,
        company: caseStudies.company,
        industry: caseStudies.industry,
        outcome: caseStudies.outcome,
        metric: caseStudies.metric,
        playbook: caseStudies.playbook,
        publishedAt: caseStudies.publishedAt,
      })
      .from(caseStudies)
      .where(
        and(
          eq(caseStudies.approvedByCompany, true),
          isNotNull(caseStudies.publishedAt),
        ),
      )
      .orderBy(desc(caseStudies.publishedAt))
      .limit(50);

    return NextResponse.json(
      { count: rows.length, caseStudies: rows },
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
      // Table missing — return empty gracefully instead of 500.
      // The page falls back to the curated examples in this state.
      return NextResponse.json(
        { count: 0, caseStudies: [] },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    log.error("GET /api/case-studies failed", { error: msg });
    return NextResponse.json(
      { count: 0, caseStudies: [], error: "Temporarily unavailable" },
      { status: 503 },
    );
  }
}
