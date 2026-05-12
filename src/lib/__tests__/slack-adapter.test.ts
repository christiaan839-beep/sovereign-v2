/**
 * Tests for src/lib/slack-adapter.ts — Cook 63.
 *
 *   - verifySlackSignature: signing-secret-missing, missing-headers,
 *     stale + future-skew rejections, invalid-signature, happy path.
 *   - parseSlashCommand: subcommand + positionals + --flag value styles.
 *   - buildResponse: ephemeral default, in-channel override.
 */

import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import {
  verifySlackSignature,
  parseSlashCommand,
  buildResponse,
  SLACK_CONSTANTS,
} from "../slack-adapter";

const SECRET = "test-slack-signing-secret-32chars";

function sign(body: string, ts: number, secret = SECRET): string {
  return (
    "v0=" +
    createHmac("sha256", secret).update(`v0:${ts}:${body}`).digest("hex")
  );
}

describe("verifySlackSignature — gating", () => {
  it("missing-secret when signing secret is empty", () => {
    const out = verifySlackSignature({
      signingSecret: "",
      signatureHeader: "v0=x",
      timestampHeader: "1",
      rawBody: "",
      now: 0,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("missing-secret");
  });

  it("missing-headers when either header is missing", () => {
    const out = verifySlackSignature({
      signingSecret: SECRET,
      signatureHeader: "",
      timestampHeader: "1",
      rawBody: "",
      now: 0,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("missing-headers");
  });

  it("missing-headers when timestamp is non-numeric", () => {
    const out = verifySlackSignature({
      signingSecret: SECRET,
      signatureHeader: "v0=x",
      timestampHeader: "not-a-number",
      rawBody: "",
      now: 0,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("missing-headers");
  });

  it("stale-timestamp when request is older than 5 minutes", () => {
    const ts = 1_700_000_000;
    const body = "command=/sovereign";
    const out = verifySlackSignature({
      signingSecret: SECRET,
      signatureHeader: sign(body, ts),
      timestampHeader: String(ts),
      rawBody: body,
      now: ts * 1000 + SLACK_CONSTANTS.MAX_REQUEST_AGE_MS + 1,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("stale-timestamp");
  });

  it("stale-timestamp when request is far in the future", () => {
    const ts = 1_700_000_000;
    const body = "x=y";
    const out = verifySlackSignature({
      signingSecret: SECRET,
      signatureHeader: sign(body, ts),
      timestampHeader: String(ts),
      rawBody: body,
      now: ts * 1000 - SLACK_CONSTANTS.MAX_FUTURE_SKEW_MS - 1,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("stale-timestamp");
  });
});

describe("verifySlackSignature — signature checks", () => {
  const ts = 1_700_000_000;
  const body = "command=/sovereign&text=run+lead-blitz";

  it("happy path verifies a correctly signed request", () => {
    const out = verifySlackSignature({
      signingSecret: SECRET,
      signatureHeader: sign(body, ts),
      timestampHeader: String(ts),
      rawBody: body,
      now: ts * 1000,
    });
    expect(out.ok).toBe(true);
  });

  it("rejects when signature was produced with a different secret", () => {
    const out = verifySlackSignature({
      signingSecret: SECRET,
      signatureHeader: sign(body, ts, "other-secret"),
      timestampHeader: String(ts),
      rawBody: body,
      now: ts * 1000,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("invalid-signature");
  });

  it("rejects when body was tampered after signing", () => {
    const out = verifySlackSignature({
      signingSecret: SECRET,
      signatureHeader: sign(body, ts),
      timestampHeader: String(ts),
      rawBody: body + "&extra=tamper",
      now: ts * 1000,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("invalid-signature");
  });
});

describe("parseSlashCommand", () => {
  it("returns null when required Slack fields are missing", () => {
    expect(parseSlashCommand("text=run")).toBeNull();
  });

  it("parses a basic /sovereign run lead-blitz command", () => {
    const body = new URLSearchParams({
      command: "/sovereign",
      text: "run lead-blitz",
      channel_id: "C123",
      user_id: "U456",
      team_id: "T789",
    }).toString();
    const cmd = parseSlashCommand(body)!;
    expect(cmd.command).toBe("/sovereign");
    expect(cmd.subcommand).toBe("run");
    expect(cmd.positional).toEqual(["lead-blitz"]);
    expect(cmd.channelId).toBe("C123");
  });

  it("parses --flag value form", () => {
    const body = new URLSearchParams({
      command: "/sovereign",
      text: "run lead-blitz --input ./i.json",
      channel_id: "C",
      user_id: "U",
      team_id: "T",
    }).toString();
    const cmd = parseSlashCommand(body)!;
    expect(cmd.flags.input).toBe("./i.json");
  });

  it("parses --flag=value form", () => {
    const body = new URLSearchParams({
      command: "/sovereign",
      text: "run lead-blitz --input=./i.json",
      channel_id: "C",
      user_id: "U",
      team_id: "T",
    }).toString();
    const cmd = parseSlashCommand(body)!;
    expect(cmd.flags.input).toBe("./i.json");
  });

  it("treats bare --flag as boolean true", () => {
    const body = new URLSearchParams({
      command: "/sovereign",
      text: "run lead-blitz --verbose",
      channel_id: "C",
      user_id: "U",
      team_id: "T",
    }).toString();
    const cmd = parseSlashCommand(body)!;
    expect(cmd.flags.verbose).toBe("true");
  });

  it("captures response_url when supplied", () => {
    const body = new URLSearchParams({
      command: "/sovereign",
      text: "run",
      channel_id: "C",
      user_id: "U",
      team_id: "T",
      response_url: "https://hooks.slack.com/x",
    }).toString();
    const cmd = parseSlashCommand(body)!;
    expect(cmd.responseUrl).toBe("https://hooks.slack.com/x");
  });
});

describe("buildResponse", () => {
  it("defaults to ephemeral", () => {
    expect(buildResponse("hi").response_type).toBe("ephemeral");
  });

  it("supports in-channel override", () => {
    expect(buildResponse("hi", { inChannel: true }).response_type).toBe(
      "in_channel",
    );
  });

  it("includes blocks when supplied", () => {
    const r = buildResponse("hi", {
      blocks: [{ type: "section", text: { type: "mrkdwn", text: "hi" } }],
    });
    expect(r.blocks).toHaveLength(1);
  });
});
