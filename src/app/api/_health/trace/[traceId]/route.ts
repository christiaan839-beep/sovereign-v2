/**
 * GET /api/health/trace/[traceId]
 *
 * Public, anonymized reasoning trace.
 *
 * Customer-facing trust artifact — anyone with a trace ID (typically
 * shared by an agent's caller) can view the redacted reasoning trace
 * showing HOW the agent arrived at its output. This is the "show me
 * how it reasoned" feature most platforms can't ship because their
 * traces are opaque or contain PII.
 *
 * Public-safe filter:
 *   * NO tenant_id, user_id, audit_id
 *   * Span names are kept as-is (already public — model names and
 *     tool names appear in the API catalog)
 *   * Span errors are stripped (could leak internal state)
 *   * Cost cents are kept (already aggregated; not per-tenant)
 *   * Durations + structure preserved
 *
 * The trace ID itself is the capability — without it, no one can
 * query. Trace IDs are 32-char hex (16 bytes); brute-force-resistant.
 *
 * Cached for 5 min — traces are immutable once persisted.
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("public-trace");

export const runtime = "nodejs";
export const revalidate = 300;

interface PublicSpan {
  id: string;
  parentId: string | null;
  kind: string;
  name: string;
  startMs: number;
  durationMs: number;
  costCents: number;
  inputBytes: number;
  outputBytes: number;
  /** Errors REPLACED with a generic flag, never the raw message. */
  errored: boolean;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ traceId: string }> },
) {
  const { traceId } = await params;
  if (!traceId || traceId.length > 100) {
    return NextResponse.json({ error: "Invalid trace id" }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  try {
    const { db } = await import("@/db");
    const { agentTraces } = await import("@/db/schema");
    const rows = await db
      .select()
      .from(agentTraces)
      .where(eq(agentTraces.id, traceId))
      .limit(1);
    if (rows.length === 0) {
      return NextResponse.json({ error: "Trace not found" }, { status: 404 });
    }
    const r = rows[0];

    // Anonymize the spans: strip error messages (could leak internal
    // state), drop everything else as-is.
    const publicSpans: PublicSpan[] = r.spans.map((s) => ({
      id: s.id,
      parentId: s.parentId,
      kind: s.kind,
      name: s.name,
      startMs: s.startMs,
      durationMs: s.durationMs,
      costCents: s.costCents,
      inputBytes: s.inputBytes,
      outputBytes: s.outputBytes,
      errored: !!s.error,
    }));

    return NextResponse.json(
      {
        traceId: r.id,
        agentName: r.agentName,
        totalDurationMs: r.totalDurationMs,
        totalCostCents: r.totalCostCents,
        spanCount: r.spanCount,
        firstError: r.firstError ? "(redacted)" : null,
        spans: publicSpans,
        capturedAt: r.createdAt,
        note: "Anonymized public reasoning trace. Span errors redacted; identifiers stripped.",
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "public, max-age=300, s-maxage=300, stale-while-revalidate=900",
        },
      },
    );
  } catch (err) {
    log.error("public trace fetch failed", { traceId, error: String(err) });
    return NextResponse.json({ error: "Failed to load trace" }, { status: 500 });
  }
}
