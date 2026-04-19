import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { slackClient } from "@/lib/slack-client";

/**
 * SLACK-NOTIFY — First-class Slack notification agent.
 *
 * Wraps src/lib/slack-client.ts so playbooks can ship a message to a
 * user's connected Slack workspace as a chain step. The client handles
 * token decryption, `invalid_auth` auto-revocation, and Slack rate-limit
 * surfacing (code: SLACK_RATE_LIMIT).
 *
 * Input:
 *   channel  — "#sales", "@user", or a channel ID (C0123…). Required.
 *   text     — Fallback text (also used as notification preview). Required.
 *   title    — Optional Block Kit header (rendered above text).
 *   context  — Optional small-text footer (e.g., "Triggered by Lead Blitz").
 *
 * Output:
 *   ok, channel, ts — Slack's message timestamp (used for threading).
 *
 * Errors:
 *   SLACK_NOT_CONNECTED — user has no active Slack OAuth row
 *   SLACK_RATE_LIMIT    — surface retryAfter (seconds) so the scheduler
 *                         can requeue; agent-factory wraps the throw into
 *                         a 502 with the original code preserved.
 *
 * Used by:
 *   - Any playbook with a {kind: "slack-notify"} step
 *   - Dashboard "Notify #sales when a lead scores > 80" workflows
 *   - hitl-approval.ts → escalation channel
 */

const schema = z.object({
  channel: z.string().min(1).max(200),
  text: z.string().min(1).max(3000),
  title: z.string().max(150).optional(),
  context: z.string().max(300).optional(),
});

export const POST = createAgentRoute({
  name: "slack-notify",
  schema,
  // Pure side-effect agent — no LLM output to score.
  skipQualityCheck: true,
  // Text is user-supplied + templated; PII scan would false-positive on
  // legitimate notifications ("Lead: alice@co.com qualified").
  skipPiiScan: true,
  handler: async ({ input, userId }) => {
    const channel = input.channel as string;
    const text = input.text as string;
    const title = input.title as string | undefined;
    const context = input.context as string | undefined;

    const slack = await slackClient(userId);
    if (!slack) {
      throw Object.assign(new Error("Slack is not connected for this user."), {
        code: "SLACK_NOT_CONNECTED",
        userFacing: true,
        remedy: "Connect your Slack workspace in Dashboard → Integrations.",
      });
    }

    // Build Block Kit payload. Slack renders `text` as the fallback
    // (notifications, screen readers), and `blocks` as the rich UI.
    const blocks: Record<string, unknown>[] = [];

    if (title) {
      blocks.push({
        type: "header",
        text: { type: "plain_text", text: title.slice(0, 150), emoji: true },
      });
    }

    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: text },
    });

    if (context) {
      blocks.push({
        type: "context",
        elements: [{ type: "mrkdwn", text: context }],
      });
    }

    const res = await slack.postMessage({
      channel,
      text, // fallback
      blocks,
    });

    return {
      ok: true,
      channel: res.channel,
      ts: res.ts,
      workspace: slack.workspaceName,
    };
  },
});
