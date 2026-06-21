/**
 * SOVEREIGN MATRIX — Scheduled Email Report Agent
 *
 * Generates and sends a weekly agent activity report via email, built
 * from the user's REAL `agent_activity` rows (last 7 days). When there is
 * no recorded activity, it sends an honest empty-state report rather than
 * fabricated numbers.
 *
 * POST /api/_agents/scheduled-report
 * Body: { email: string }
 */

import { createAgentRoute } from "@/lib/agent-factory";
import { sendEmail } from "@/lib/email-service";
import { db } from "@/db";
import { agentActivity } from "@/db/schema";
import { and, eq, gte } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("scheduled-report");

interface AgentActivitySummary {
  agentName: string;
  runs: number;
  avgDurationMs: number;
  successRate: number;
}

/**
 * Aggregate the user's real agent activity for the last 7 days, grouped by
 * agent. Terminal actions ("completed"/"failed") drive the success rate;
 * durations come from `metadata.durationMs` when present. Returns [] on a
 * missing table (42P01) or any DB error — never fabricates.
 */
async function fetchWeeklyActivity(
  userId: string,
): Promise<AgentActivitySummary[]> {
  if (!userId) return [];
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  let rows: Array<{
    agentName: string;
    action: string;
    metadata: string | null;
  }> = [];
  try {
    rows = await db
      .select({
        agentName: agentActivity.agentName,
        action: agentActivity.action,
        metadata: agentActivity.metadata,
      })
      .from(agentActivity)
      .where(
        and(
          eq(agentActivity.userId, userId),
          gte(agentActivity.createdAt, weekAgo),
        ),
      );
  } catch (err) {
    // Missing table or transient DB error → honest empty report.
    log.warn("agent_activity query failed; sending empty-state report", {
      error: String(err),
    });
    return [];
  }

  const byAgent = new Map<
    string,
    { runs: number; completed: number; failed: number; durations: number[] }
  >();
  for (const r of rows) {
    const agg = byAgent.get(r.agentName) ?? {
      runs: 0,
      completed: 0,
      failed: 0,
      durations: [],
    };
    agg.runs += 1;
    if (r.action === "completed") agg.completed += 1;
    else if (r.action === "failed") agg.failed += 1;
    if (r.metadata) {
      try {
        const d = (JSON.parse(r.metadata) as { durationMs?: unknown })
          .durationMs;
        if (typeof d === "number" && Number.isFinite(d) && d >= 0) {
          agg.durations.push(d);
        }
      } catch {
        /* non-JSON metadata — ignore */
      }
    }
    byAgent.set(r.agentName, agg);
  }

  return Array.from(byAgent.entries())
    .map(([agentName, a]) => {
      const terminal = a.completed + a.failed;
      const successRate =
        terminal > 0 ? a.completed / terminal : a.runs > 0 ? 1 : 0;
      const avgDurationMs =
        a.durations.length > 0
          ? Math.round(
              a.durations.reduce((s, d) => s + d, 0) / a.durations.length,
            )
          : 0;
      return { agentName, runs: a.runs, avgDurationMs, successRate };
    })
    .sort((x, y) => y.runs - x.runs);
}

function generateReportSummary(activity: AgentActivitySummary[]) {
  const totalRuns = activity.reduce((sum, a) => sum + a.runs, 0);
  const avgSuccess =
    activity.length > 0
      ? activity.reduce((sum, a) => sum + a.successRate, 0) / activity.length
      : 0;

  return {
    totalRuns,
    avgSuccessRate: Math.round(avgSuccess * 100),
    topAgent: activity[0]?.agentName ?? "N/A",
    periodStart: getWeekStart(),
    periodEnd: new Date().toISOString().split("T")[0],
  };
}

function getWeekStart(): string {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split("T")[0];
}

// ── HTML Email Template ──

function buildReportHtml(
  summary: ReturnType<typeof generateReportSummary>,
  activity: AgentActivitySummary[],
): string {
  const hasActivity = activity.length > 0;

  const body = hasActivity
    ? `
    <!-- KPI Cards -->
    <div style="display: flex; gap: 12px; margin-bottom: 28px;">
      <div style="flex: 1; background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; text-align: center; border: 1px solid rgba(255,255,255,0.08);">
        <div style="color: #10b981; font-size: 28px; font-weight: 700;">${summary.totalRuns}</div>
        <div style="color: #888; font-size: 12px; margin-top: 4px;">Agents Run</div>
      </div>
      <div style="flex: 1; background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; text-align: center; border: 1px solid rgba(255,255,255,0.08);">
        <div style="color: #6366f1; font-size: 28px; font-weight: 700;">${summary.avgSuccessRate}%</div>
        <div style="color: #888; font-size: 12px; margin-top: 4px;">Success Rate</div>
      </div>
      <div style="flex: 1; background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; text-align: center; border: 1px solid rgba(255,255,255,0.08);">
        <div style="color: #f59e0b; font-size: 18px; font-weight: 700; margin-top: 6px;">${summary.topAgent}</div>
        <div style="color: #888; font-size: 12px; margin-top: 4px;">Top Agent</div>
      </div>
    </div>

    <!-- Activity Table -->
    <table style="width: 100%; border-collapse: collapse; background: rgba(255,255,255,0.03); border-radius: 12px; overflow: hidden;">
      <thead>
        <tr style="background: rgba(255,255,255,0.06);">
          <th style="padding: 12px 16px; text-align: left; color: #aaa; font-size: 12px; font-weight: 600; text-transform: uppercase;">Agent</th>
          <th style="padding: 12px 16px; text-align: center; color: #aaa; font-size: 12px; font-weight: 600; text-transform: uppercase;">Runs</th>
          <th style="padding: 12px 16px; text-align: center; color: #aaa; font-size: 12px; font-weight: 600; text-transform: uppercase;">Avg Time</th>
          <th style="padding: 12px 16px; text-align: center; color: #aaa; font-size: 12px; font-weight: 600; text-transform: uppercase;">Success</th>
        </tr>
      </thead>
      <tbody>
        ${activity
          .map(
            (a) => `
      <tr>
        <td style="padding: 10px 16px; border-bottom: 1px solid #1a1a2e; color: #e0e0e0;">${a.agentName}</td>
        <td style="padding: 10px 16px; border-bottom: 1px solid #1a1a2e; color: #e0e0e0; text-align: center;">${a.runs}</td>
        <td style="padding: 10px 16px; border-bottom: 1px solid #1a1a2e; color: #e0e0e0; text-align: center;">${a.avgDurationMs > 0 ? (a.avgDurationMs / 1000).toFixed(1) + "s" : "—"}</td>
        <td style="padding: 10px 16px; border-bottom: 1px solid #1a1a2e; color: #e0e0e0; text-align: center;">${Math.round(a.successRate * 100)}%</td>
      </tr>`,
          )
          .join("")}
      </tbody>
    </table>`
    : `
    <div style="background: rgba(255,255,255,0.04); border-radius: 12px; padding: 28px 20px; text-align: center; border: 1px solid rgba(255,255,255,0.08);">
      <p style="color: #e0e0e0; font-size: 15px; margin: 0;">No agent activity recorded this week.</p>
      <p style="color: #888; font-size: 13px; margin: 8px 0 0;">Run an agent from your dashboard and it will show up in next week's report.</p>
    </div>`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin: 0; padding: 0; background-color: #030303; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 640px; margin: 0 auto; padding: 32px 20px;">

    <!-- Header -->
    <div style="text-align: center; margin-bottom: 32px;">
      <h1 style="color: #ffffff; font-size: 24px; margin: 0;">Sovereign Matrix</h1>
      <p style="color: #888; font-size: 14px; margin: 4px 0 0;">Weekly Agent Activity Report</p>
      <p style="color: #666; font-size: 12px; margin: 4px 0 0;">${summary.periodStart} &mdash; ${summary.periodEnd}</p>
    </div>

    ${body}

    <!-- Footer -->
    <div style="text-align: center; margin-top: 32px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.06);">
      <p style="color: #555; font-size: 12px; margin: 0;">Sovereign Matrix — AI Agent Intelligence Platform</p>
      <p style="color: #444; font-size: 11px; margin: 4px 0 0;">You received this because you enabled weekly reports.</p>
    </div>

  </div>
</body>
</html>`.trim();
}

// ── Agent Route ──

export const POST = createAgentRoute({
  name: "scheduled-report",
  requiredFields: ["email"],
  skipJailbreakCheck: true,
  skipSafetyCheck: true,
  skipQualityCheck: true,

  handler: async ({ input, userId }) => {
    const email = input.email as string;

    // Real activity for the authenticated user (empty-state when none).
    const activity = await fetchWeeklyActivity(userId);
    const summary = generateReportSummary(activity);

    const html = buildReportHtml(summary, activity);
    const subject = `Sovereign Matrix — Weekly Report (${summary.periodStart})`;

    const emailResult = await sendEmail(email, subject, html, {
      tags: ["weekly-report", "automated"],
    });

    return {
      success: emailResult.success,
      report: summary,
      emailResult: {
        delivered: emailResult.success,
        messageId: emailResult.messageId,
        reason: emailResult.reason,
      },
    };
  },
});
