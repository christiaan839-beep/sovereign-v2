import { NextResponse } from "next/server";
import { persistRead, persistAppend } from "@/lib/persist";
import { requireAdmin } from "@/lib/admin-auth";
import { verifyInternalSecretHeader } from "@/lib/internal-secret";

/**
 * ERROR TRACKING — Centralized error logging and visibility.
 *
 * Served publicly via [...catchall] (/api/errors). Two abuse vectors
 * closed here (BACKLOG unauth-errors):
 *  - GET returned raw stack traces (internal paths / embedded secrets)
 *    to anyone → now admin-only.
 *  - POST let anyone append `critical` records to flip the status page
 *    to DEGRADED → now requires the internal server-to-server secret.
 *
 * Operations:
 * - POST: Log a new error (internal callers only)
 * - GET: View recent errors and error rate (admin only)
 */

interface ErrorRecord {
  id: string;
  agent: string;
  error: string;
  stack?: string;
  timestamp: string;
  severity: "low" | "medium" | "high" | "critical";
}

export async function POST(request: Request) {
  if (!verifyInternalSecretHeader(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { agent, error, stack, severity = "medium" } = await request.json();

    if (!agent || !error) {
      return NextResponse.json(
        { error: "agent and error required." },
        { status: 400 },
      );
    }

    const record: ErrorRecord = {
      id: `err-${Date.now()}`,
      agent,
      error: String(error).substring(0, 500),
      stack: String(stack || "").substring(0, 1000),
      timestamp: new Date().toISOString(),
      severity,
    };

    persistAppend("error-log", record, 500);

    return NextResponse.json({ success: true, recorded: record });
  } catch (err) {
    return NextResponse.json(
      { error: "Error tracker error", details: String(err) },
      { status: 500 },
    );
  }
}

export async function GET() {
  const gate = await requireAdmin();
  if (gate instanceof Response) return gate;
  const errors = persistRead<ErrorRecord[]>("error-log", []);

  // Calculate error rate (last hour)
  const oneHourAgo = Date.now() - 3600000;
  const recentErrors = errors.filter(
    (e) => new Date(e.timestamp).getTime() > oneHourAgo,
  );

  // Group by agent
  const byAgent: Record<string, number> = {};
  for (const e of errors) {
    byAgent[e.agent] = (byAgent[e.agent] || 0) + 1;
  }

  return NextResponse.json({
    status: recentErrors.length > 10 ? "DEGRADED" : "HEALTHY",
    total_errors: errors.length,
    last_hour: recentErrors.length,
    by_severity: {
      critical: errors.filter((e) => e.severity === "critical").length,
      high: errors.filter((e) => e.severity === "high").length,
      medium: errors.filter((e) => e.severity === "medium").length,
      low: errors.filter((e) => e.severity === "low").length,
    },
    by_agent: Object.entries(byAgent)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10),
    recent: errors.slice(-10).reverse(),
  });
}
