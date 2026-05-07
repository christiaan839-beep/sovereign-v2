/**
 * Ops alerts — fire-and-forget posts to a Slack incoming webhook.
 *
 * Used for revenue events (first-paying-customer, payment failed,
 * cancellations) so the operator gets a real-time pulse on the business
 * without polling the dashboard. Reads `SLACK_OPS_WEBHOOK_URL`; if it's
 * unset, the function is a no-op so dev environments aren't noisy.
 *
 * Never await this on the hot path — these calls run inside webhook
 * handlers that must return 200 fast. Slack outages must not block
 * subscription writes.
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("ops-alert");

export type OpsAlertLevel = "info" | "warn" | "error";

export interface OpsAlert {
  level: OpsAlertLevel;
  title: string;
  /** Optional structured fields rendered as Slack mrkdwn `*key:* value`. */
  fields?: Record<string, string | number | undefined | null>;
  /** Optional dollar amount, formatted for revenue events. */
  amountUsd?: number;
}

const LEVEL_EMOJI: Record<OpsAlertLevel, string> = {
  info: ":dollar:",
  warn: ":warning:",
  error: ":rotating_light:",
};

function formatAlert(alert: OpsAlert): string {
  const lines: string[] = [];
  lines.push(`${LEVEL_EMOJI[alert.level]} *${alert.title}*`);
  if (typeof alert.amountUsd === "number") {
    lines.push(`*Amount:* $${alert.amountUsd.toFixed(2)} USD`);
  }
  if (alert.fields) {
    for (const [k, v] of Object.entries(alert.fields)) {
      if (v === undefined || v === null || v === "") continue;
      lines.push(`*${k}:* ${v}`);
    }
  }
  return lines.join("\n");
}

/**
 * Post a Slack message. Never throws. Always settles within ~5s.
 */
export async function sendOpsAlert(alert: OpsAlert): Promise<void> {
  const url = process.env.SLACK_OPS_WEBHOOK_URL;
  if (!url) return;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: formatAlert(alert) }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      log.warn("Ops alert rejected by Slack", {
        status: res.status,
        title: alert.title,
      });
    }
  } catch (err) {
    log.warn("Ops alert post failed", {
      error: err instanceof Error ? err.message : String(err),
      title: alert.title,
    });
  }
}

/**
 * Convenience wrapper for the "make money this month" loop —
 * `getPlan()` returns the priceUsdCents the operator needs to see.
 */
export function planToAmount(planUsdCents: number): number {
  return planUsdCents / 100;
}
