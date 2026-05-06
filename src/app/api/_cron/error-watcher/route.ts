import { NextResponse } from "next/server";
import { db } from "@/db";
import { errorLogs } from "@/db/schema";
import { gte, sql } from "drizzle-orm";
import { requireCronAuth } from "@/lib/cron-auth";
import { createLogger } from "@/lib/logger";

export const runtime = "nodejs";

const log = createLogger("error-watcher");

/**
 * GET /api/_cron/error-watcher
 *
 * Runs every 10 minutes. Reads the `error_logs` table for entries
 * since the previous run and pages Slack if any are at
 * severity=high or severity=critical. Without this, error_logs is
 * write-only — the founder finds out about real failures from
 * customer messages instead of from instrumentation.
 *
 * Bucket strategy:
 *   - count by severity in the last 10-min window
 *   - count by agent_id (top 5) so the punch list is actionable
 *   - if total high+critical > 0, post to SLACK_OPS_WEBHOOK_URL
 *   - if total errors > 50 in 10 min, escalate the message ("storm")
 *   - heartbeat every 6th run (~hourly) when nothing's wrong, so
 *     a silent watcher (cron broken) is detectable
 *
 * Failure modes:
 *   - error_logs missing (migration 0004 not applied) → 200 with
 *     skipped flag; never pages Slack (nothing real to report)
 *   - DB unreachable → 200 with skipped flag + warn log
 *   - Slack webhook down → swallowed; never fails the cron
 */

const WINDOW_MINUTES = 10;
const HEARTBEAT_EVERY_N_RUNS = 6;
// Heartbeat counter is per-Lambda-instance, not global. On Vercel
// each cold start resets the counter to 0, so the actual "every 6
// runs" cadence is best-effort: a Lambda kept warm fires the
// heartbeat hourly; a fleet of cold Lambdas may delay it. That's
// acceptable for a green-light signal — silence over multiple hours
// still indicates the watcher itself is broken, which is the only
// failure mode this signal exists to catch. Don't migrate this to
// Redis: a missed heartbeat is fine, a phantom one would be worse.
let runsSinceHeartbeat = 0;

interface ErrorBucket {
  severity: string;
  count: number;
}

interface AgentBucket {
  agentId: string;
  count: number;
}

export async function GET(req: Request) {
  const authErr = requireCronAuth(req);
  if (authErr) return authErr;

  let severityBuckets: ErrorBucket[] = [];
  let agentBuckets: AgentBucket[] = [];
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);

  try {
    severityBuckets = (await db
      .select({
        severity: errorLogs.severity,
        count: sql<number>`count(*)::int`,
      })
      .from(errorLogs)
      .where(gte(errorLogs.createdAt, since))
      .groupBy(errorLogs.severity)) as ErrorBucket[];

    agentBuckets = (await db
      .select({
        agentId: sql<string>`coalesce(${errorLogs.agentId}, 'unknown')`,
        count: sql<number>`count(*)::int`,
      })
      .from(errorLogs)
      .where(gte(errorLogs.createdAt, since))
      .groupBy(errorLogs.agentId)
      .orderBy(sql`count(*) desc`)
      .limit(5)) as AgentBucket[];
  } catch (err) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "42P01") {
      // error_logs missing — migration 0004 not applied. Don't page.
      return NextResponse.json({ ok: true, skipped: "error_logs missing" });
    }
    log.warn("error-watcher query failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: false, error: "DB unavailable" });
  }

  const total = severityBuckets.reduce((s, b) => s + b.count, 0);
  const highCount =
    (severityBuckets.find((b) => b.severity === "high")?.count ?? 0) +
    (severityBuckets.find((b) => b.severity === "critical")?.count ?? 0);
  const isStorm = total > 50;

  const shouldPage = highCount > 0 || isStorm;
  const shouldHeartbeat =
    !shouldPage && ++runsSinceHeartbeat >= HEARTBEAT_EVERY_N_RUNS;
  if (shouldHeartbeat) runsSinceHeartbeat = 0;

  if (shouldPage || shouldHeartbeat) {
    void notifySlack({
      shouldPage,
      isStorm,
      total,
      highCount,
      severityBuckets,
      agentBuckets,
      windowMinutes: WINDOW_MINUTES,
    });
  }

  log.info("error-watcher complete", {
    total,
    highCount,
    paged: shouldPage,
    heartbeat: shouldHeartbeat,
  });

  return NextResponse.json({
    ok: true,
    windowMinutes: WINDOW_MINUTES,
    total,
    highCount,
    isStorm,
    paged: shouldPage,
    severityBuckets,
    agentBuckets,
  });
}

async function notifySlack(args: {
  shouldPage: boolean;
  isStorm: boolean;
  total: number;
  highCount: number;
  severityBuckets: ErrorBucket[];
  agentBuckets: AgentBucket[];
  windowMinutes: number;
}): Promise<void> {
  const webhook = process.env.SLACK_OPS_WEBHOOK_URL;
  if (!webhook) return;

  const lines: string[] = [];
  if (args.shouldPage) {
    if (args.isStorm) {
      lines.push(
        `🌩 *Error storm — ${args.total} errors in last ${args.windowMinutes}m*`,
      );
    } else {
      lines.push(
        `🚨 *${args.highCount} high/critical error${args.highCount === 1 ? "" : "s"} in last ${args.windowMinutes}m*`,
      );
    }
    if (args.severityBuckets.length > 0) {
      lines.push(
        "*By severity:* " +
          args.severityBuckets
            .map((b) => `${b.severity}=${b.count}`)
            .join(", "),
      );
    }
    if (args.agentBuckets.length > 0) {
      lines.push("*Top sources:*");
      for (const a of args.agentBuckets) {
        lines.push(`  • \`${a.agentId}\` — ${a.count}`);
      }
    }
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || "https://sovereignmatrix.agency";
    lines.push(`👉 \`${appUrl}/dashboard/admin\` for details`);
  } else {
    lines.push(
      `💚 *Error watcher heartbeat* — quiet last ${args.windowMinutes * HEARTBEAT_EVERY_N_RUNS}m (≈${(HEARTBEAT_EVERY_N_RUNS * args.windowMinutes) / 60}h)`,
    );
  }

  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: lines.join("\n") }),
    });
  } catch {
    // Slack outage cannot fail the cron.
  }
}
