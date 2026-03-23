/**
 * SOVEREIGN MATRIX — Slack Integration
 *
 * Send notifications to Slack channels via incoming webhooks.
 * Users configure their Slack webhook URL in Settings > Webhooks.
 *
 * Usage:
 *   import { sendSlackNotification } from "@/lib/slack";
 *   await sendSlackNotification(webhookUrl, "Agent completed task", { agent: "seo-dominator" });
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("slack");

interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  elements?: Array<{ type: string; text: string; emoji?: boolean }>;
  fields?: Array<{ type: string; text: string }>;
}

export async function sendSlackNotification(
  webhookUrl: string,
  message: string,
  metadata?: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  if (!webhookUrl) {
    return { success: false, error: "No Slack webhook URL configured" };
  }

  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: { type: "plain_text", text: "Sovereign Matrix", emoji: true },
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: message },
    },
  ];

  // Add metadata fields if provided
  if (metadata && Object.keys(metadata).length > 0) {
    blocks.push({
      type: "section",
      fields: Object.entries(metadata).map(([key, value]) => ({
        type: "mrkdwn",
        text: `*${key}:*\n${value}`,
      })),
    });
  }

  blocks.push({
    type: "context",
    elements: [
      { type: "mrkdwn", text: `Sent at ${new Date().toISOString()}` },
    ],
  });

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });

    if (!res.ok) {
      log.error("Slack webhook failed", { status: res.status });
      return { success: false, error: `Slack returned ${res.status}` };
    }

    return { success: true };
  } catch (err) {
    log.error("Slack send failed", { error: err instanceof Error ? err.message : "unknown" });
    return { success: false, error: "Network error" };
  }
}
