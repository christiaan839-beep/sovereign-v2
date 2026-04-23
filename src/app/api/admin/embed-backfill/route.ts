/**
 * POST /api/admin/embed-backfill
 *
 * One-shot admin operation: compute + store semantic-search embeddings
 * for every verified + public agent that doesn't have one yet. Safe
 * to re-run — rows that already have an embedding are skipped.
 *
 * Scoping logic:
 *   - Only WHERE verificationStatus = 'verified' AND isPublic = true
 *   - Only WHERE embedding IS NULL (idempotent)
 *   - Batched in groups of `batchSize` (default 10) to stay within
 *     NIM's per-request limits and give operators an interruptable
 *     progress view.
 *
 * Query params:
 *   ?batchSize=N     how many agents to embed in one invocation (1..50)
 *   ?dryRun=1        report what would be embedded without writing
 *
 * Auth: requireAdmin() — Clerk + ADMIN_USER_IDS allowlist.
 * Non-admins get a 404 (no endpoint-existence leak).
 *
 * Intended operator flow:
 *   1. Deploy semantic search + the first new agent rows (ship event)
 *   2. Run backfill once against /api/admin/embed-backfill to catch
 *      legacy rows (lead-blitz / content-machine / etc)
 *   3. Ongoing: every new approval auto-embeds via admin-submissions.ts,
 *      so backfill should only need to run again after model upgrades
 */

import { NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { marketplaceAgents } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import {
  agentCorpusText,
  embedAndStoreAgent,
} from "@/lib/marketplace-search";
import { createLogger } from "@/lib/logger";

const log = createLogger("embed-backfill");

function clampBatch(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 10;
  return Math.min(Math.floor(n), 50);
}

export async function POST(request: Request): Promise<Response> {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

  const url = new URL(request.url);
  const batchSize = clampBatch(url.searchParams.get("batchSize"));
  const dryRun = url.searchParams.get("dryRun") === "1";

  // Pull N candidates that need embedding. Limit the dataset up front
  // so the endpoint stays snappy — repeat runs catch the rest.
  let candidates: Array<{
    id: string;
    name: string;
    description: string;
    category: string;
    manifestRaw: unknown;
  }>;
  try {
    candidates = await db
      .select({
        id: marketplaceAgents.id,
        name: marketplaceAgents.name,
        description: marketplaceAgents.description,
        category: marketplaceAgents.category,
        manifestRaw: marketplaceAgents.manifestRaw,
      })
      .from(marketplaceAgents)
      .where(
        and(
          eq(marketplaceAgents.verificationStatus, "verified"),
          eq(marketplaceAgents.isPublic, true),
          isNull(marketplaceAgents.embedding),
        ),
      )
      .limit(batchSize);
  } catch (err) {
    log.error("backfill candidate query failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { ok: false, error: "db_query_failed" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Also report how many rows still need embedding after this batch,
  // so operators know when they're done.
  let remaining = 0;
  try {
    const rows = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(marketplaceAgents)
      .where(
        and(
          eq(marketplaceAgents.verificationStatus, "verified"),
          eq(marketplaceAgents.isPublic, true),
          isNull(marketplaceAgents.embedding),
        ),
      );
    remaining = Math.max(0, Number(rows[0]?.n ?? 0) - candidates.length);
  } catch {
    remaining = -1; // unknown — non-fatal
  }

  if (dryRun) {
    return NextResponse.json(
      {
        ok: true,
        dryRun: true,
        candidates: candidates.map((c) => ({
          id: c.id,
          name: c.name,
        })),
        remaining,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Process one at a time. Parallel would cut wall time, but NIM
  // rate limits matter more than speed on a one-shot backfill; serial
  // keeps us well under any per-second cap.
  const results: Array<{ id: string; name: string; ok: boolean }> = [];
  for (const c of candidates) {
    const manifestRaw =
      c.manifestRaw && typeof c.manifestRaw === "object"
        ? (c.manifestRaw as Record<string, unknown>)
        : null;
    const corpus = agentCorpusText({
      name: c.name,
      description: c.description,
      category: c.category,
      manifestRaw,
    });
    const ok = await embedAndStoreAgent({ id: c.id, corpusText: corpus });
    results.push({ id: c.id, name: c.name, ok });
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.length - succeeded;

  log.info("backfill batch complete", {
    adminUserId: gate.userId,
    batchSize,
    succeeded,
    failed,
    remaining,
  });

  return NextResponse.json(
    {
      ok: true,
      dryRun: false,
      processed: results.length,
      succeeded,
      failed,
      remaining,
      results,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
