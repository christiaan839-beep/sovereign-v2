/**
 * GET /api/admin/trace/[traceId]
 *
 * Operator forensic tool: pull a full agent execution trace.
 * Returns the spans array + metadata. Admin-only — traces may
 * contain sensitive intermediate state.
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-trace");

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ traceId: string }> },
) {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;

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
    return NextResponse.json({
      trace: rows[0],
    });
  } catch (err) {
    log.error("trace fetch failed", { traceId, error: String(err) });
    return NextResponse.json({ error: "Failed to load trace" }, { status: 500 });
  }
}
