/**
 * SOVEREIGN MATRIX — User Notification System
 *
 * Sends notifications to users when agents complete work.
 * Channels: in-app (agentActivity), Slack webhook, email.
 *
 * Usage:
 *   await notifyUser(userId, {
 *     title: "Lead report ready",
 *     message: "Found 23 qualified prospects in Austin, TX",
 *     agent: "leads",
 *     channel: "all",
 *   });
 */

import { persistAgentActivity } from "@/lib/activity-persist";
import { createLogger } from "@/lib/logger";

const log = createLogger("notify");

interface NotifyOptions {
  title: string;
  message: string;
  agent: string;
  /** Which channels to notify on: "all" | "app" | "slack" | "email" */
  channel?: "all" | "app" | "slack" | "email";
  /** User's email (for email notifications) */
  email?: string;
  /** Additional data to include */
  metadata?: Record<string, unknown>;
}

/**
 * Send a notification to a user across configured channels.
 * Always writes to in-app activity feed. Optionally sends to Slack/email.
 */
export async function notifyUser(userId: string, options: NotifyOptions): Promise<void> {
  const { title, message, agent, channel = "app", email, metadata } = options;

  // 1. Always: in-app notification (agentActivity table)
  await persistAgentActivity({
    userId,
    agentName: agent,
    agentType: agent,
    action: "completed",
    summary: `${title}: ${message}`.slice(0, 200),
    metadata: metadata ? JSON.stringify(metadata) : undefined,
  }).catch(() => {});

  // 2. Slack webhook (if configured and channel includes slack)
  if (channel === "all" || channel === "slack") {
    const slackUrl = process.env.SLACK_WEBHOOK_URL;
    if (slackUrl) {
      try {
        await fetch(slackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `*${title}*\n${message}`,
            blocks: [
              {
                type: "section",
                text: {
                  type: "mrkdwn",
                  text: `*${title}*\n${message}\n_Agent: ${agent}_`,
                },
              },
            ],
          }),
          signal: AbortSignal.timeout(5000),
        });
      } catch (err) {
        log.warn("Slack notification failed", { error: String(err) });
      }
    }
  }

  // 3. Email (if configured and channel includes email)
  if ((channel === "all" || channel === "email") && email) {
    try {
      const { sendEmail } = await import("@/lib/email");
      await sendEmail({
        to: email,
        subject: title,
        html: `<div style="font-family: sans-serif; padding: 20px; background: #0a0a0a; color: #e5e5e5;">
          <h2 style="color: white; margin-bottom: 8px;">${title}</h2>
          <p style="color: #a3a3a3; line-height: 1.6;">${message}</p>
          <p style="color: #525252; font-size: 12px; margin-top: 16px;">Agent: ${agent} | <a href="https://sovereignmatrix.agency/dashboard/results" style="color: #10b981;">View in Dashboard</a></p>
        </div>`,
      });
    } catch (err) {
      log.warn("Email notification failed", { error: String(err) });
    }
  }
}

/**
 * Notify on agent completion — call from agent-factory after successful execution.
 */
export async function notifyAgentComplete(
  userId: string,
  agentName: string,
  summary: string,
  email?: string
): Promise<void> {
  await notifyUser(userId, {
    title: `${agentName} completed`,
    message: summary.slice(0, 200),
    agent: agentName,
    channel: "all",
    email,
  });
}
