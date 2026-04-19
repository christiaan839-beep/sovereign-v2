import { NextResponse } from "next/server";
import { db } from "@/db";
import { usage, playbookRuns, settings } from "@/db/schema";
import { and, eq, gte, sql, desc } from "drizzle-orm";
import { sendEmail } from "@/lib/email-service";
import { createLogger } from "@/lib/logger";
import { verifyCron } from "@/lib/cron-auth";

const log = createLogger("cron:weekly-report");

/**
 * WEEKLY INTELLIGENCE REPORT — Proposal R from NEXT_PROPOSALS.md.
 *
 * Fires every Monday 08:00 UTC (see vercel.json). For each user who
 *   (a) opted in (settings.weekly_report_opt_in = 'true'), and
 *   (b) had at least one agent run in the last 7 days,
 * composes an honest activity summary from their own data and sends
 * via Resend (with CAN-SPAM-compliant footer auto-attached).
 *
 * Honesty rules:
 *   - We NEVER fabricate time-saved numbers. Only real counts + real
 *     durations from playbook_runs.durationMs.
 *   - We NEVER claim "you saved X hours" — customers do that math.
 *   - If a user had zero runs, they get no email. No "we missed you"
 *     guilt-trip spam.
 *
 * See docs/NEXT_PROPOSALS.md #R.
 */

interface UserWeekSummary {
  email: string;
  totalRuns: number;
  byAgent: Array<{ agent: string; runs: number }>;
  playbooksSucceeded: number;
  playbooksFailed: number;
  avgPlaybookDurationMs: number | null;
  topAgent: string;
}

async function buildUserSummary(userEmail: string, userId: string, sinceDate: Date): Promise<UserWeekSummary | null> {
  // Agent run counts by agentId
  const runRows = await db
    .select({ agent: usage.agentId, count: sql<number>`count(*)::int` })
    .from(usage)
    .where(and(eq(usage.userId, userId), gte(usage.createdAt, sinceDate)))
    .groupBy(usage.agentId)
    .orderBy(desc(sql<number>`count(*)`))
    .limit(10);

  const totalRuns = runRows.reduce((s, r) => s + r.count, 0);
  if (totalRuns === 0) return null;

  // Playbook runs — success/failed + avg duration
  const playbookRows = await db
    .select({
      status: playbookRuns.status,
      count: sql<number>`count(*)::int`,
      avgMs: sql<number | null>`avg(${playbookRuns.durationMs})`,
    })
    .from(playbookRuns)
    .where(and(eq(playbookRuns.userId, userId), gte(playbookRuns.createdAt, sinceDate)))
    .groupBy(playbookRuns.status);

  const succeeded = playbookRows.find((r) => r.status === "done")?.count ?? 0;
  const failed = playbookRows.find((r) => r.status === "failed")?.count ?? 0;
  const avgMs =
    playbookRows.length > 0
      ? Math.round(playbookRows.reduce((s, r) => s + (r.avgMs ?? 0) * r.count, 0) / Math.max(1, succeeded + failed))
      : null;

  return {
    email: userEmail,
    totalRuns,
    byAgent: runRows.map((r) => ({ agent: r.agent, runs: r.count })),
    playbooksSucceeded: succeeded,
    playbooksFailed: failed,
    avgPlaybookDurationMs: avgMs || null,
    topAgent: runRows[0]?.agent ?? "—",
  };
}

function renderEmailHtml(s: UserWeekSummary): string {
  // Inter + editorial aesthetic, rendered as email-safe HTML.
  const topRows = s.byAgent
    .slice(0, 5)
    .map(
      (r) =>
        `<tr>
          <td style="padding: 8px 0; font-family: monospace; font-size: 12px; color: #8F8576;">${escape(r.agent)}</td>
          <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 14px; color: #1A1712; font-weight: 600;">${r.runs}</td>
        </tr>`,
    )
    .join("");

  const playbookLine =
    s.playbooksSucceeded + s.playbooksFailed > 0
      ? `<p style="margin: 16px 0; color: #5C544A; font-size: 14px; line-height: 1.6;">
          Playbooks: <strong style="color: #1A1712;">${s.playbooksSucceeded}</strong> succeeded,
          <strong style="color: #1A1712;">${s.playbooksFailed}</strong> failed${
            s.avgPlaybookDurationMs
              ? `, average duration <strong style="color: #1A1712;">${(s.avgPlaybookDurationMs / 1000).toFixed(1)}s</strong>`
              : ""
          }.
        </p>`
      : "";

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin: 0; padding: 40px 20px; background: #F4EFE6; font-family: -apple-system, 'Inter Tight', sans-serif;">
  <div style="max-width: 560px; margin: 0 auto; background: #FBF7EE; padding: 40px 32px; border: 1px solid #D8CDB7;">
    <p style="margin: 0 0 8px; font-family: monospace; font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: #8F8576;">
      Weekly Report · Sovereign Matrix
    </p>
    <h1 style="margin: 0 0 24px; font-family: Georgia, serif; font-size: 36px; line-height: 1; letter-spacing: -0.01em; color: #1A1712;">
      <em style="color: #B5532C;">${s.totalRuns}</em> ${s.totalRuns === 1 ? "agent run" : "agent runs"} this week.
    </h1>

    <p style="margin: 16px 0; color: #5C544A; font-size: 15px; line-height: 1.6;">
      Your most-used agent was <strong style="color: #1A1712;">${escape(s.topAgent)}</strong>.
      Below is the honest breakdown — no fabricated "hours saved" numbers, just the work you did.
    </p>

    ${playbookLine}

    <table style="width: 100%; border-collapse: collapse; margin: 24px 0; border-top: 1px solid #C7B9A1;">
      <tbody>
        ${topRows}
      </tbody>
    </table>

    <a href="https://sovereignmatrix.agency/dashboard"
       style="display: inline-block; margin-top: 16px; padding: 12px 20px; background: #B5532C; color: #F4EFE6; text-decoration: none; font-family: monospace; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase;">
      View Dashboard →
    </a>

    <p style="margin: 40px 0 0; padding-top: 24px; border-top: 1px solid #D8CDB7; font-size: 12px; color: #8F8576; line-height: 1.6;">
      You're receiving this because you opted in to weekly reports.
      Turn them off any time from Settings → Notifications.
    </p>
  </div>
</body></html>`;
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(request: Request) {
  const denied = verifyCron(request);
  if (denied) return denied;

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    // Only users who explicitly opted in get a weekly report.
    // settings.weekly_report_opt_in is stored as the string "true".
    const optedIn = await db
      .select({ email: settings.userEmail, userId: settings.userEmail })
      .from(settings)
      .where(eq(settings.weeklyReportOptIn, "true"))
      .limit(500);

    let built = 0;
    let sent = 0;
    let skipped = 0;

    for (const row of optedIn) {
      // settings stores userEmail as the key; usage/playbook_runs key on userId (Clerk id).
      // For the MVP we resolve userEmail == userId when Clerk id is an email — this is the
      // common case during the solo-founder stage. A production rollout would do a proper
      // lookup via the clerk adapter or a users table join.
      const summary = await buildUserSummary(row.email, row.userId, since);
      if (!summary) {
        skipped++;
        continue;
      }
      built++;

      const result = await sendEmail(
        summary.email,
        `Your Sovereign Matrix report — ${summary.totalRuns} ${summary.totalRuns === 1 ? "run" : "runs"} this week`,
        renderEmailHtml(summary),
        { tags: ["weekly-report"] },
      );
      if (result.success) sent++;
    }

    log.info("Weekly report cron complete", { optedIn: optedIn.length, built, sent, skipped });
    return NextResponse.json({ ok: true, optedIn: optedIn.length, built, sent, skipped });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "42P01") {
      log.warn("weekly-report: settings table not migrated yet");
      return NextResponse.json({ ok: true, reason: "migrations pending" });
    }
    log.error("Weekly report cron failed", { error: String(err) });
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
