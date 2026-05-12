/**
 * Tests for src/lib/github-adapter.ts — Cook 64.
 *
 *   - verifyGitHubWebhook: missing-secret / header / event,
 *     invalid-signature, malformed-payload, happy path.
 *   - extractPRReview: null on draft / closed, valid PR opens / syncs.
 *   - buildCheckRun: required-fields validation, conclusion requirement.
 */

import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import {
  verifyGitHubWebhook,
  extractPRReview,
  buildCheckRun,
} from "../github-adapter";

const SECRET = "github-webhook-secret-32-chars-ok";

function sign(body: string, secret = SECRET): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

describe("verifyGitHubWebhook — gating", () => {
  it("missing-secret when secret empty", () => {
    const out = verifyGitHubWebhook(
      { webhookSecret: "", signatureHeader: "sha256=x", rawBody: "{}" },
      "ping",
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("missing-secret");
  });

  it("missing-header when signature absent", () => {
    const out = verifyGitHubWebhook(
      { webhookSecret: SECRET, signatureHeader: "", rawBody: "{}" },
      "ping",
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("missing-header");
  });

  it("missing-event when event header absent", () => {
    const body = "{}";
    const out = verifyGitHubWebhook(
      {
        webhookSecret: SECRET,
        signatureHeader: sign(body),
        rawBody: body,
      },
      "",
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("missing-event");
  });

  it("invalid-signature when body mismatched", () => {
    const out = verifyGitHubWebhook(
      {
        webhookSecret: SECRET,
        signatureHeader: sign("{}"),
        rawBody: "{tampered:true}",
      },
      "ping",
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("invalid-signature");
  });

  it("invalid-signature when signed with different secret", () => {
    const body = "{}";
    const out = verifyGitHubWebhook(
      {
        webhookSecret: SECRET,
        signatureHeader: sign(body, "other-secret"),
        rawBody: body,
      },
      "ping",
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("invalid-signature");
  });

  it("malformed-payload when body isn't JSON", () => {
    const body = "<xml></xml>";
    const out = verifyGitHubWebhook(
      {
        webhookSecret: SECRET,
        signatureHeader: sign(body),
        rawBody: body,
      },
      "ping",
    );
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.reason).toBe("malformed-payload");
  });

  it("happy path returns event name", () => {
    const body = '{"action":"opened"}';
    const out = verifyGitHubWebhook(
      {
        webhookSecret: SECRET,
        signatureHeader: sign(body),
        rawBody: body,
      },
      "pull_request",
    );
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.event).toBe("pull_request");
  });
});

describe("extractPRReview", () => {
  const pr = {
    action: "opened",
    pull_request: {
      number: 42,
      draft: false,
      head: { sha: "abc123" },
    },
    repository: { full_name: "acme/widget" },
  };

  it("returns null for non-PR events", () => {
    expect(extractPRReview("push", pr)).toBeNull();
  });

  it("returns null for draft PRs", () => {
    expect(
      extractPRReview("pull_request", {
        ...pr,
        pull_request: { ...pr.pull_request, draft: true },
      }),
    ).toBeNull();
  });

  it("returns null for closed action", () => {
    expect(
      extractPRReview("pull_request", { ...pr, action: "closed" }),
    ).toBeNull();
  });

  it("returns review request on opened", () => {
    const r = extractPRReview("pull_request", pr);
    expect(r).toEqual({
      repoFullName: "acme/widget",
      number: 42,
      headSha: "abc123",
      action: "opened",
    });
  });

  it("returns review request on synchronize", () => {
    const r = extractPRReview("pull_request", {
      ...pr,
      action: "synchronize",
    });
    expect(r?.action).toBe("synchronize");
  });

  it("returns null for malformed payloads", () => {
    expect(extractPRReview("pull_request", null)).toBeNull();
    expect(
      extractPRReview("pull_request", {
        action: "opened",
        pull_request: {},
        repository: {},
      }),
    ).toBeNull();
  });
});

describe("buildCheckRun", () => {
  it("returns a complete body for queued status", () => {
    const body = buildCheckRun({
      name: "sovereign/code-review",
      headSha: "abc123",
      status: "queued",
    });
    expect(body.name).toBe("sovereign/code-review");
    expect(body.head_sha).toBe("abc123");
    expect(body.status).toBe("queued");
    expect(body.conclusion).toBeUndefined();
  });

  it("requires conclusion when status=completed", () => {
    expect(() =>
      buildCheckRun({
        name: "x",
        headSha: "y",
        status: "completed",
      }),
    ).toThrow(/conclusion/);
  });

  it("includes output + timestamps when supplied", () => {
    const t = Date.parse("2026-05-12T10:00:00Z");
    const body = buildCheckRun({
      name: "x",
      headSha: "y",
      status: "completed",
      conclusion: "success",
      output: { title: "OK", summary: "All checks passed" },
      startedAt: t,
      completedAt: t + 1000,
    });
    expect(body.started_at).toBe("2026-05-12T10:00:00.000Z");
    expect(body.completed_at).toBe("2026-05-12T10:00:01.000Z");
    expect(body.conclusion).toBe("success");
    expect(body.output).toMatchObject({ title: "OK" });
  });

  it("rejects empty name or sha", () => {
    expect(() =>
      buildCheckRun({ name: "", headSha: "x", status: "queued" }),
    ).toThrow();
    expect(() =>
      buildCheckRun({ name: "x", headSha: "", status: "queued" }),
    ).toThrow();
  });
});
