import { NextResponse } from "next/server";
import { persistRead, persistAppend } from "@/lib/persist";

/**
 * ERROR TRACKING — Centralized error logging and visibility.
 * 
 * Agents can POST errors here. The status page reads from here.
 * 
 * Operations:
 * - POST: Log a new error
 * - GET: View recent errors and error rate
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
  try {
    const { agent, error, stack, severity = "medium" } = await request.json();

    if (!agent || !error) {
      return NextResponse.json({ error: "agent and error required." }, { status: 400 });
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
    return NextResponse.json({ error: "Error tracker error", details: String(err) }, { status: 500 });
  }
}

export async function GET() {
  const errors = persistRead<ErrorRecord[]>("error-log", []);

  // Calculate error rate (last hour)
  const oneHourAgo = Date.now() - 3600000;
  const recentErrors = errors.filter(e => new Date(e.timestamp).getTime() > oneHourAgo);

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
      critical: errors.filter(e => e.severity === "critical").length,
      high: errors.filter(e => e.severity === "high").length,
      medium: errors.filter(e => e.severity === "medium").length,
      low: errors.filter(e => e.severity === "low").length,
    },
    by_agent: Object.entries(byAgent).sort((a, b) => b[1] - a[1]).slice(0, 10),
    recent: errors.slice(-10).reverse(),
  });
}
