/**
 * SOVEREIGN MATRIX — Cron alert dispatch (Wave 144).
 *
 * Real implementation of `sendAlert` for the cron orchestrator.
 * Fires to every channel configured by env var:
 *   - SLACK_WEBHOOK_URL          → text payload
 *   - TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID → text payload
 *   - DISCORD_WEBHOOK_URL        → content payload
 *
 * All channels are best-effort; one webhook 500 doesn't block the
 * others. Returns the per-channel success/fail map for operator
 * visibility.
 *
 * Every outbound call goes through outboundFetch with a per-host
 * allowlist + 8s timeout.
 */

import { outboundFetchAsResponse } from "@/lib/outbound-fetch";
import { createLogger } from "@/lib/logger";

const log = createLogger("cron-alerts");

const TIMEOUT_MS = 8_000;

async function fireSlack(text: string): Promise<boolean> {
  const url = process.env.SLACK_WEBHOOK_URL?.trim();
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    const res = await outboundFetchAsResponse(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
      { ruleId: "cron-alerts.slack", allowedHosts: [host] },
    );
    return res.ok;
  } catch (err) {
    log.warn("slack alert failed", { error: String(err) });
    return false;
  }
}

async function fireTelegram(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return false;
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await outboundFetchAsResponse(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
      {
        ruleId: "cron-alerts.telegram",
        allowedHosts: ["api.telegram.org"],
      },
    );
    return res.ok;
  } catch (err) {
    log.warn("telegram alert failed", { error: String(err) });
    return false;
  }
}

async function fireDiscord(text: string): Promise<boolean> {
  const url = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    const res = await outboundFetchAsResponse(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text.slice(0, 2000) }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
      { ruleId: "cron-alerts.discord", allowedHosts: [host] },
    );
    return res.ok;
  } catch (err) {
    log.warn("discord alert failed", { error: String(err) });
    return false;
  }
}

/**
 * Fire every configured channel in parallel. Returns a per-channel
 * boolean map. Missing env vars → channel absent from result map.
 */
export async function sendCronAlert(
  text: string,
): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {};
  const tasks: Array<Promise<void>> = [];

  if (process.env.SLACK_WEBHOOK_URL?.trim()) {
    tasks.push(
      fireSlack(text).then((ok) => {
        out.slack = ok;
      }),
    );
  }
  if (
    process.env.TELEGRAM_BOT_TOKEN?.trim() &&
    process.env.TELEGRAM_CHAT_ID?.trim()
  ) {
    tasks.push(
      fireTelegram(text).then((ok) => {
        out.telegram = ok;
      }),
    );
  }
  if (process.env.DISCORD_WEBHOOK_URL?.trim()) {
    tasks.push(
      fireDiscord(text).then((ok) => {
        out.discord = ok;
      }),
    );
  }

  await Promise.allSettled(tasks);
  return out;
}
