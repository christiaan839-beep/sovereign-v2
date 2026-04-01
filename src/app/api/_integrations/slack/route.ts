/**
 * POST /api/_integrations/slack
 *
 * Sends a message to a Slack channel via incoming webhook.
 * Requires SLACK_WEBHOOK_URL env var (standard Slack incoming webhook URL).
 *
 * Body: { text: string, channel?: string, blocks?: object[] }
 */

import { NextResponse } from "next/server";
import { guardRoute, errorResponse, sanitizeString, validateRequired } from "@/lib/api-guard";
import { createLogger } from "@/lib/logger";

const log = createLogger("integration:slack");

interface SlackPayload {
  text: string;
  channel?: string;
  blocks?: Record<string, unknown>[];
}

export async function POST(req: Request) {
  try {
    const auth = await guardRoute();
    if (!auth.authorized) return auth.response;

    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      log.warn("Slack webhook not configured");
      return errorResponse(
        "Slack not configured. Add SLACK_WEBHOOK_URL to env vars.",
        503,
        "SLACK_NOT_CONFIGURED"
      );
    }

    const body = await req.json();
    const missing = validateRequired(body, ["text"]);
    if (missing) return errorResponse(missing, 400, "VALIDATION_ERROR");

    const payload: SlackPayload = {
      text: sanitizeString(body.text, 4000),
    };

    if (body.channel) {
      payload.channel = sanitizeString(body.channel, 200);
    }
    if (Array.isArray(body.blocks)) {
      payload.blocks = body.blocks.slice(0, 50);
    }

    log.info("Sending Slack message", { channel: payload.channel ?? "default", userId: auth.userId });

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "Unknown error");
      log.error("Slack webhook failed", { status: res.status, error: errorText });
      return errorResponse(`Slack API error: ${res.status}`, 502, "SLACK_API_ERROR");
    }

    log.info("Slack message sent successfully");
    return NextResponse.json({ success: true, status: res.status });
  } catch (err) {
    log.error("Slack integration error", { error: String(err) });
    return errorResponse("Failed to send Slack message", 500, "SLACK_ERROR");
  }
}
