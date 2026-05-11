/**
 * GET /api/me/insights — receipt-backed analytics for the caller.
 *
 * Aggregates the user's `agent_runs` rows over a configurable window
 * (default 30 days, max 90) into the metrics product teams actually
 * screenshot for stakeholders:
 *
 *   - daily invocation count
 *   - total runs in window + safety pass rate
 *   - top agents by volume
 *   - p50 / p95 / p99 latency (computed in memory from the slice)
 *   - flagged-output counts (jailbreak / pii / content fails)
 *
 * Aggregation is in-process — the slice is bounded to 5,000 rows
 * (window * heaviest user we expect) which is comfortable for Node
 * to chew through without a Postgres window function.
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { agentRuns } from "@/db/schema";
import { and, eq, gte } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/me/insights");
const MAX_DAYS = 90;
const DEFAULT_DAYS = 30;
const HARD_ROW_CAP = 5000;

interface SafetyResult {
  jailbreak?: "pass" | "fail";
  pii?: "pass" | "fail";
  content?: "pass" | "fail";
  quality?: number;
  critic?: "pass" | "fail";
}

interface DayBucket {
  date: string;
  count: number;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.floor((sorted.length * p) / 100),
  );
  return sorted[idx]!;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function safeParse(s: string): SafetyResult {
  try {
    return JSON.parse(s) as SafetyResult;
  } catch {
    return {};
  }
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const rawDays = Number(url.searchParams.get("days") ?? DEFAULT_DAYS);
  const days = Math.max(
    1,
    Math.min(MAX_DAYS, Number.isFinite(rawDays) ? rawDays : DEFAULT_DAYS),
  );
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  let rows: Array<{
    agentName: string;
    durationMs: number;
    safetyResult: string;
    trustDecision: string;
    createdAt: Date | null;
  }> = [];
  try {
    rows = await db
      .select({
        agentName: agentRuns.agentName,
        durationMs: agentRuns.durationMs,
        safetyResult: agentRuns.safetyResult,
        trustDecision: agentRuns.trustDecision,
        createdAt: agentRuns.createdAt,
      })
      .from(agentRuns)
      .where(and(eq(agentRuns.userId, userId), gte(agentRuns.createdAt, since)))
      .limit(HARD_ROW_CAP);
  } catch (err) {
    log.warn("insights query failed — returning empty result", {
      error: err instanceof Error ? err.message : String(err),
    });
    rows = [];
  }

  // ── Per-day bucket
  const dayMap = new Map<string, number>();
  // Pre-seed every day in the window with 0 so the chart has no gaps
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000);
    dayMap.set(isoDay(d), 0);
  }
  for (const r of rows) {
    if (!r.createdAt) continue;
    const k = isoDay(r.createdAt);
    dayMap.set(k, (dayMap.get(k) ?? 0) + 1);
  }
  const dailyInvocations: DayBucket[] = Array.from(dayMap.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, count]) => ({ date, count }));

  // ── Top agents
  const agentCounts = new Map<string, number>();
  for (const r of rows) {
    agentCounts.set(r.agentName, (agentCounts.get(r.agentName) ?? 0) + 1);
  }
  const topAgents = Array.from(agentCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  // ── Latency distribution
  const durations = rows.map((r) => r.durationMs).sort((a, b) => a - b);
  const latency = {
    p50: percentile(durations, 50),
    p95: percentile(durations, 95),
    p99: percentile(durations, 99),
    avg:
      durations.length === 0
        ? 0
        : Math.round(durations.reduce((s, n) => s + n, 0) / durations.length),
  };

  // ── Safety
  let jailbreakFails = 0;
  let piiFails = 0;
  let contentFails = 0;
  let criticFails = 0;
  let qualitySum = 0;
  let qualityCount = 0;
  let blocked = 0;

  for (const r of rows) {
    if (r.trustDecision === "blocked") blocked++;
    const s = safeParse(r.safetyResult);
    if (s.jailbreak === "fail") jailbreakFails++;
    if (s.pii === "fail") piiFails++;
    if (s.content === "fail") contentFails++;
    if (s.critic === "fail") criticFails++;
    if (typeof s.quality === "number") {
      qualitySum += s.quality;
      qualityCount++;
    }
  }

  const totalRuns = rows.length;
  const fullyClean =
    totalRuns -
    rows.filter((r) => {
      const s = safeParse(r.safetyResult);
      return (
        s.jailbreak === "fail" ||
        s.pii === "fail" ||
        s.content === "fail" ||
        s.critic === "fail"
      );
    }).length;
  const safetyPassRate =
    totalRuns === 0 ? 100 : Math.round((fullyClean * 1000) / totalRuns) / 10;

  return NextResponse.json({
    windowDays: days,
    truncated: rows.length === HARD_ROW_CAP,
    totalRuns,
    safetyPassRate,
    blockedCount: blocked,
    flagged: {
      jailbreak: jailbreakFails,
      pii: piiFails,
      content: contentFails,
      critic: criticFails,
    },
    avgQualityScore:
      qualityCount === 0 ? null : Math.round(qualitySum / qualityCount),
    latencyMs: latency,
    dailyInvocations,
    topAgents,
  });
}
