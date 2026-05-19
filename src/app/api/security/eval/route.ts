/**
 * GET /api/security/eval
 *
 * Public, open-CORS — returns the LATEST persisted adversarial-eval
 * result. Lets any verifier independently observe:
 *
 *   - Block rate over the frozen corpus
 *   - Per-category breakdown
 *   - False-positive count over the benign set
 *   - Corpus fingerprint (sha256 over the entire set; verifier can
 *     diff against their local copy to confirm the published number
 *     was computed over the corpus they think it was)
 *   - ML-DSA-65 signature (post-quantum) when the cron's deployment
 *     was configured with the signing key
 *
 * Returns 404 when no eval has been persisted yet (e.g., before the
 * first cron run) rather than 500 — consumers treat "no data" as a
 * configuration finding, not an error.
 *
 * Cache: 5 min. The eval cron writes once per 24h; aggressive caching
 * is fine and absorbs the procurement-questionnaire fan-out pattern.
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { and, eq, desc, sql } from "drizzle-orm";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

const log = createLogger("security-eval");

export const revalidate = 300;

// Per-IP limit mirrors the sibling transparency/trs route. The
// audit_logs lookup without an index on (action, resource) is scan-
// shaped; the limiter caps unauthenticated enumeration cost.
const limiter = rateLimit({ interval: 60, limit: 20 });

const NOT_FOUND = (msg: string) =>
  NextResponse.json(
    { error: msg },
    {
      status: 404,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60, s-maxage=60",
      },
    },
  );

export async function GET(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  let row: { details: string | null; createdAt: Date | null } | undefined;
  try {
    const rows = await db
      .select({
        details: auditLogs.details,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.action, "adversarial.eval"),
          sql`${auditLogs.resource} LIKE ${"corpus:%"}`,
        ),
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(1);
    row = rows[0];
  } catch (err) {
    // Generic 404 — same pattern as transparency/trs to avoid leaking
    // deploy state (table-missing vs no-row) to unauthenticated
    // probes (wave-95 security finding).
    log.warn("audit_logs read failed for adversarial-eval lookup", {
      error: String(err),
    });
    return NOT_FOUND("no adversarial-eval result available");
  }

  if (!row) {
    return NOT_FOUND("no adversarial-eval result available");
  }

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(row.details ?? "{}") as Record<string, unknown>;
  } catch {
    return NOT_FOUND("eval row is malformed");
  }

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      persistedAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
      schema: parsed.schema ?? "vaos-adversarial-eval-v1",
      ranAt: parsed.ranAt ?? null,
      durationMs: parsed.durationMs ?? null,
      corpusFingerprint: parsed.corpusFingerprint ?? null,
      attack: parsed.attack ?? null,
      benign: parsed.benign ?? null,
      compositeScore: parsed.compositeScore ?? null,
      mldsa65Sig: parsed.mldsa65Sig ?? null,
      pqEnabled: parsed.pqEnabled ?? false,
      notes:
        "Verify by importing @/lib/adversarial-corpus (Apache-2.0) and " +
        "recomputing corpusFingerprint() against the local set. If hashes " +
        "match, the published numbers were computed over the corpus you're " +
        "inspecting. Then check mldsa65Sig against the public ML-DSA-65 " +
        "key at /.well-known/sovereign-receipts/mldsa65.b64 to confirm " +
        "the result wasn't tampered with after the cron run.",
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=300, s-maxage=300",
        "Content-Type": "application/json; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
