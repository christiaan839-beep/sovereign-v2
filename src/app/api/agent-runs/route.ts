/**
 * GET /api/agent-runs — list the caller's recent agent runs.
 *
 * Powers the /dashboard/receipts page. Returns the 50 most recent
 * runs keyed to the caller, with truncated input/output previews so
 * the list is fast and still useful at a glance.
 *
 * Query params:
 *   ?limit=N   — clamped to [1, 200], default 50
 *   ?cursor=ID — fetch next page (rows older than the cursor row's
 *                created_at; UUID lookup tolerates clock skew)
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { agentRuns } from "@/db/schema";
import { and, desc, eq, lt } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/agent-runs/list");
const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;
const PREVIEW_BYTES = 280;

function preview(s: string): string {
  if (s.length <= PREVIEW_BYTES) return s;
  return s.slice(0, PREVIEW_BYTES) + "…";
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const rawLimit = Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT);
  const limit = Math.max(
    1,
    Math.min(MAX_LIMIT, Number.isFinite(rawLimit) ? rawLimit : DEFAULT_LIMIT),
  );
  const cursor = url.searchParams.get("cursor");

  let cursorTime: Date | null = null;
  if (cursor) {
    try {
      const cur = await db
        .select({ createdAt: agentRuns.createdAt })
        .from(agentRuns)
        .where(eq(agentRuns.id, cursor))
        .limit(1);
      if (cur[0]?.createdAt) cursorTime = cur[0].createdAt;
    } catch {
      // fall through — cursor is best-effort
    }
  }

  try {
    const where = cursorTime
      ? and(eq(agentRuns.userId, userId), lt(agentRuns.createdAt, cursorTime))
      : eq(agentRuns.userId, userId);

    const rows = await db
      .select({
        id: agentRuns.id,
        agentName: agentRuns.agentName,
        modelUsed: agentRuns.modelUsed,
        durationMs: agentRuns.durationMs,
        trustDecision: agentRuns.trustDecision,
        visibility: agentRuns.visibility,
        signature: agentRuns.signature,
        createdAt: agentRuns.createdAt,
        inputJson: agentRuns.inputJson,
        outputJson: agentRuns.outputJson,
        safetyResult: agentRuns.safetyResult,
      })
      .from(agentRuns)
      .where(where)
      .orderBy(desc(agentRuns.createdAt))
      .limit(limit);

    const items = rows.map((r) => ({
      id: r.id,
      agentName: r.agentName,
      modelUsed: r.modelUsed,
      durationMs: r.durationMs,
      trustDecision: r.trustDecision,
      visibility: r.visibility,
      signaturePrefix: r.signature.slice(0, 16),
      createdAt: r.createdAt,
      inputPreview: preview(r.inputJson),
      outputPreview: preview(r.outputJson),
      safetyResult: safeParse(r.safetyResult),
    }));

    return NextResponse.json({
      items,
      nextCursor: items.length === limit ? items[items.length - 1]!.id : null,
    });
  } catch (err) {
    log.warn("list runs failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ items: [], nextCursor: null });
  }
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
