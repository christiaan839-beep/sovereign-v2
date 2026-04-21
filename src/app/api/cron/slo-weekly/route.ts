/**
 * /api/cron/slo-weekly — weekly SLO breach check + Slack notification.
 *
 * Schedule: 0 9 * * 1  (Monday 9 AM UTC — start of work-week summary).
 *
 * Flow:
 *   1. verifyCron() — Bearer CRON_SECRET
 *   2. checkAllSLOs() — reads 7/30-day rolling samples from Redis,
 *      calls classifyBreach() per SLO, returns BreachReport[].
 *   3. If any SLO breached AND SLACK_WEBHOOK_URL is set, POST a
 *      formatted summary to Slack. Otherwise just return the reports
 *      so they show up in Vercel Cron logs.
 *
 * Designed to fail open: Slack webhook down → cron still returns 200,
 * reports are in the response body, Vercel alerts the operator via
 * cron-fail alerting instead.
 */

import { NextResponse } from "next/server";
import { verifyCron } from "@/lib/cron-auth";
import { checkAllSLOs } from "@/lib/slo-tracking";

async function handle(request: Request): Promise<Response> {
  const unauthorized = verifyCron(request);
  if (unauthorized) return unauthorized;

  try {
    const reports = await checkAllSLOs();
    const breaches = reports.filter((r) => r.breached);

    let slackPosted = false;
    const webhook = process.env.SLACK_WEBHOOK_URL;
    if (breaches.length > 0 && webhook) {
      slackPosted = await postBreachesToSlack(webhook, breaches);
    }

    return NextResponse.json({
      ok: true,
      total: reports.length,
      breaches: breaches.length,
      ok_count: reports.length - breaches.length,
      slackPosted,
      reports,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

async function postBreachesToSlack(
  webhook: string,
  breaches: Awaited<ReturnType<typeof checkAllSLOs>>,
): Promise<boolean> {
  const lines = breaches.map((b) => `• *${b.slo}* — ${b.message} (${b.sampleCount} samples, ${b.windowDays}d)`);
  const payload = {
    text: `🚨 ${breaches.length} SLO breach${breaches.length === 1 ? "" : "es"} this week`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `SLO Breach — ${breaches.length}`, emoji: true },
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: lines.join("\n") },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "Dashboard: <https://sovereignmatrix.agency/dashboard/admin/eval-health|/admin/eval-health>",
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
