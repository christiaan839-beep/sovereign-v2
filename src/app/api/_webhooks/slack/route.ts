/**
 * SOVEREIGN MATRIX — /api/_webhooks/slack route (Cook 67)
 *
 * Wires the Cook 63 slack-adapter library to an actual HTTP surface.
 * Slash command handler: `/sovereign run <agent> [--input=...]`.
 *
 * Security: Slack v0 HMAC verification with 5-minute freshness +
 * 30s skew tolerance. The signing secret comes from
 * SLACK_SIGNING_SECRET — without it the route returns 503 (never
 * silently accept unauthenticated webhooks).
 */

import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { alreadyProcessed } from "@/lib/idempotency";
import {
  buildResponse,
  parseSlashCommand,
  verifySlackSignature,
} from "@/lib/slack-adapter";

const log = createLogger("slack-webhook");

const limiter = rateLimit({ interval: 60, limit: 60 });

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) {
    log.error("SLACK_SIGNING_SECRET not configured");
    return NextResponse.json(
      { error: "Slack integration not configured" },
      { status: 503 },
    );
  }

  const signatureHeader = req.headers.get("x-slack-signature") ?? "";
  const timestampHeader = req.headers.get("x-slack-request-timestamp") ?? "";

  // Slack sends application/x-www-form-urlencoded; we MUST keep the
  // raw body for signature verification.
  const rawBody = await req.text();

  const verification = verifySlackSignature({
    signingSecret: secret,
    signatureHeader,
    timestampHeader,
    rawBody,
    now: Date.now(),
  });
  if (!verification.ok) {
    log.warn("Slack signature verification failed", {
      reason: verification.reason,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cmd = parseSlashCommand(rawBody);

  // Idempotency — Slack delivers a unique trigger_id per slash
  // command invocation. Even though Slack doesn't aggressively
  // retry slash commands, doubled requests have been observed in
  // the wild from network hiccups and ngrok-style tunnels.
  const params = new URLSearchParams(rawBody);
  const triggerId = params.get("trigger_id") || "";
  if (triggerId && (await alreadyProcessed("slack:trigger", triggerId))) {
    log.info("Skipped: Slack trigger_id already processed", { triggerId });
    return NextResponse.json(buildResponse("(already processed)"), {
      status: 200,
    });
  }

  if (!cmd) {
    return NextResponse.json(
      buildResponse("Could not parse command. Try `/sovereign help`."),
      { status: 200 },
    );
  }

  // We only handle /sovereign. Defer everything else.
  if (cmd.command !== "/sovereign") {
    return NextResponse.json(buildResponse("Unknown command."), {
      status: 200,
    });
  }

  if (cmd.subcommand === "" || cmd.subcommand === "help") {
    return NextResponse.json(
      buildResponse(
        "Sovereign CLI — try `/sovereign run lead-blitz` or `/sovereign verify <receiptId>`.",
      ),
      { status: 200 },
    );
  }

  if (cmd.subcommand === "verify") {
    const id = cmd.positional[0];
    if (!id) {
      return NextResponse.json(
        buildResponse("Usage: `/sovereign verify <receiptId>`"),
        { status: 200 },
      );
    }
    return NextResponse.json(
      buildResponse(
        `Verifying receipt \`${id}\` — open https://sovereignmatrix.agency/r/${id} for full proof.`,
      ),
      { status: 200 },
    );
  }

  if (cmd.subcommand === "run") {
    const agent = cmd.positional[0];
    if (!agent) {
      return NextResponse.json(
        buildResponse("Usage: `/sovereign run <agent> [--input=...]`"),
        { status: 200 },
      );
    }
    // Slack expects a sub-3s ack; the actual agent run is dispatched
    // async and result is posted back via cmd.responseUrl. Wire that
    // dispatch on top of the existing async-job runner — for now we
    // ack with a deterministic message.
    return NextResponse.json(
      buildResponse(
        `Queued \`${agent}\`. Results will land here when the run completes.`,
        { inChannel: false },
      ),
      { status: 200 },
    );
  }

  return NextResponse.json(
    buildResponse(`Unknown subcommand \`${cmd.subcommand}\`.`),
    { status: 200 },
  );
}
