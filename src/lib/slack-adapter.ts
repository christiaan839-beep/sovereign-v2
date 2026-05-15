/**
 * SOVEREIGN MATRIX — Slack bot adapter (Cook 63 / Tier 5 #21)
 *
 * Pure adapter for the Slack slash-command + interactive-message
 * surface. Production wires `/api/_webhooks/slack` to call into this
 * module; tests verify protocol correctness without any HTTP I/O.
 *
 * Slack's request signing scheme (v0):
 *
 *   sig_basestring = "v0:" + timestamp + ":" + body
 *   expected       = "v0=" + hex(HMAC-SHA256(signing_secret, sig_basestring))
 *   constant_time_compare(expected, x-slack-signature)
 *
 * Plus a 5-minute timestamp freshness gate to block replay.
 */

import { createHmac, timingSafeEqual } from "crypto";

// ── Public types ──────────────────────────────────────────────────────────

export interface SlackVerifyArgs {
  signingSecret: string;
  signatureHeader: string;
  timestampHeader: string;
  rawBody: string;
  /** Current time injected for determinism. */
  now: number;
}

export type SlackVerifyOutcome =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "missing-secret"
        | "missing-headers"
        | "stale-timestamp"
        | "invalid-signature";
    };

export interface SlashCommand {
  command: string; // "/sovereign"
  subcommand: string; // first token after the command
  positional: string[]; // remaining tokens
  flags: Record<string, string>;
  /** Original text payload, unparsed. */
  text: string;
  /** Slack channel id this came from. */
  channelId: string;
  /** Slack user id who invoked the command. */
  userId: string;
  /** Optional response_url Slack supplies for async replies. */
  responseUrl?: string;
  /** Team id (workspace). */
  teamId: string;
}

// ── Signature verification ────────────────────────────────────────────────

const MAX_REQUEST_AGE_MS = 5 * 60 * 1000;
// Allow a small clock-skew window so a slightly-fast Slack edge doesn't
// reject our verifier when the timestamp is a hair in the future.
const MAX_FUTURE_SKEW_MS = 30_000;

/**
 * Verify a Slack v0 request signature. Returns a structured outcome
 * so callers can log without exposing the failure reason to the user.
 */
export function verifySlackSignature(
  args: SlackVerifyArgs,
): SlackVerifyOutcome {
  if (!args.signingSecret) return { ok: false, reason: "missing-secret" };
  if (!args.signatureHeader || !args.timestampHeader) {
    return { ok: false, reason: "missing-headers" };
  }
  const ts = Number(args.timestampHeader);
  if (!Number.isFinite(ts)) {
    return { ok: false, reason: "missing-headers" };
  }
  const ageMs = args.now - ts * 1000;
  if (ageMs > MAX_REQUEST_AGE_MS || ageMs < -MAX_FUTURE_SKEW_MS) {
    return { ok: false, reason: "stale-timestamp" };
  }
  const base = `v0:${args.timestampHeader}:${args.rawBody}`;
  const expected =
    "v0=" + createHmac("sha256", args.signingSecret).update(base).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(args.signatureHeader);
  if (a.length !== b.length) {
    return { ok: false, reason: "invalid-signature" };
  }
  return timingSafeEqual(a, b)
    ? { ok: true }
    : { ok: false, reason: "invalid-signature" };
}

// ── Slash-command parser ──────────────────────────────────────────────────

/**
 * Parse a Slack `application/x-www-form-urlencoded` slash command
 * body. The body shape Slack POSTs:
 *
 *   command=/sovereign&text=run+lead-blitz+--input+./i.json
 *     &channel_id=C123&user_id=U456&team_id=T789&response_url=...
 *
 * Returns null on shape errors (caller can surface a generic 400).
 */
export function parseSlashCommand(rawBody: string): SlashCommand | null {
  const params = new URLSearchParams(rawBody);
  const command = params.get("command");
  const channelId = params.get("channel_id");
  const userId = params.get("user_id");
  const teamId = params.get("team_id");
  if (!command || !channelId || !userId || !teamId) return null;

  const text = (params.get("text") ?? "").trim();
  const tokens = text.length === 0 ? [] : text.split(/\s+/);
  const subcommand = tokens.shift() ?? "";

  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.startsWith("--")) {
      const body = tok.slice(2);
      const eq = body.indexOf("=");
      if (eq >= 0) {
        flags[body.slice(0, eq)] = body.slice(eq + 1);
      } else {
        const next = tokens[i + 1];
        if (next !== undefined && !next.startsWith("--")) {
          flags[body] = next;
          i++;
        } else {
          flags[body] = "true";
        }
      }
    } else {
      positional.push(tok);
    }
  }

  return {
    command,
    subcommand,
    positional,
    flags,
    text,
    channelId,
    userId,
    teamId,
    responseUrl: params.get("response_url") ?? undefined,
  };
}

// ── Response builder ──────────────────────────────────────────────────────

export interface SlackBlock {
  type: string;
  text?: { type: "mrkdwn" | "plain_text"; text: string };
  // Slack accepts many other fields; we keep this open-ended on purpose.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface SlackResponse {
  /** "ephemeral" (only visible to caller) or "in_channel". */
  response_type: "ephemeral" | "in_channel";
  text: string;
  blocks?: SlackBlock[];
}

/**
 * Build a Block Kit response. Ephemeral by default so an error
 * message doesn't accidentally broadcast a stack trace into a public
 * channel.
 */
export function buildResponse(
  text: string,
  options?: {
    blocks?: SlackBlock[];
    inChannel?: boolean;
  },
): SlackResponse {
  return {
    response_type: options?.inChannel ? "in_channel" : "ephemeral",
    text,
    ...(options?.blocks ? { blocks: options.blocks } : {}),
  };
}

export const SLACK_CONSTANTS = {
  MAX_REQUEST_AGE_MS,
  MAX_FUTURE_SKEW_MS,
};
