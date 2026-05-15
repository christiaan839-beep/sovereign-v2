/**
 * SOVEREIGN MATRIX — GitHub App adapter (Cook 64 / Tier 5 #25)
 *
 * Pure adapter for GitHub App webhooks + check-run reporting. The
 * actual HTTP handler in `/api/_webhooks/github` will call into this
 * module; tests verify protocol correctness without any HTTP I/O.
 *
 * GitHub's webhook signature scheme:
 *
 *   expected = "sha256=" + hex(HMAC-SHA256(webhook_secret, rawBody))
 *   constant_time_compare(expected, x-hub-signature-256)
 *
 * Check-run state machine: queued → in_progress → completed.
 * Conclusions: success / failure / neutral / cancelled / skipped /
 * timed_out / action_required.
 */

import { createHmac, timingSafeEqual } from "crypto";

// ── Public types ──────────────────────────────────────────────────────────

export type WebhookEvent =
  | "pull_request"
  | "push"
  | "issues"
  | "check_run"
  | "installation"
  | "installation_repositories"
  | "ping";

export type PullRequestAction =
  | "opened"
  | "synchronize"
  | "reopened"
  | "closed"
  | "ready_for_review";

export type CheckConclusion =
  | "success"
  | "failure"
  | "neutral"
  | "cancelled"
  | "skipped"
  | "timed_out"
  | "action_required";

export interface GitHubVerifyArgs {
  webhookSecret: string;
  signatureHeader: string;
  rawBody: string;
}

export type GitHubVerifyOutcome =
  | { ok: true; event: WebhookEvent | string }
  | {
      ok: false;
      reason:
        | "missing-secret"
        | "missing-header"
        | "missing-event"
        | "invalid-signature"
        | "malformed-payload";
    };

export interface PRReviewRequest {
  /** Repo full name "owner/repo". */
  repoFullName: string;
  /** PR number. */
  number: number;
  /** Head commit SHA the review should attach to. */
  headSha: string;
  /** Action that triggered us. */
  action: PullRequestAction;
}

export interface CheckRunRequest {
  /** Reused with the existing `code-reviewer` agent. */
  name: string;
  /** Head commit the check attaches to. */
  headSha: string;
  /** Conclusion when status is "completed". */
  conclusion?: CheckConclusion;
  /** "queued" | "in_progress" | "completed". */
  status: "queued" | "in_progress" | "completed";
  /** Title + summary shown in the GitHub UI. */
  output?: {
    title: string;
    summary: string;
    text?: string;
  };
  /** Optional unix-ms timestamp for `started_at` / `completed_at`. */
  startedAt?: number;
  completedAt?: number;
}

// ── Signature verification ────────────────────────────────────────────────

/**
 * Verify a GitHub webhook signature. The caller is expected to pass
 * the `x-github-event` and `x-hub-signature-256` headers separately
 * (not in headers map form — keeps this module zero-dep).
 */
export function verifyGitHubWebhook(
  args: GitHubVerifyArgs,
  eventHeader: string,
): GitHubVerifyOutcome {
  if (!args.webhookSecret) return { ok: false, reason: "missing-secret" };
  if (!args.signatureHeader) return { ok: false, reason: "missing-header" };
  if (!eventHeader) return { ok: false, reason: "missing-event" };

  const expected =
    "sha256=" +
    createHmac("sha256", args.webhookSecret).update(args.rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(args.signatureHeader);
  if (a.length !== b.length) {
    return { ok: false, reason: "invalid-signature" };
  }
  if (!timingSafeEqual(a, b)) {
    return { ok: false, reason: "invalid-signature" };
  }
  // Light shape check on the payload — GitHub sometimes posts
  // application/x-www-form-urlencoded with `payload=` wrapping. We
  // assume JSON; the route handler should reject non-JSON content-types.
  try {
    JSON.parse(args.rawBody);
  } catch {
    return { ok: false, reason: "malformed-payload" };
  }
  return { ok: true, event: eventHeader };
}

// ── Pull-request review extraction ────────────────────────────────────────

/**
 * Pull the fields the code-review agent needs out of a pull_request
 * webhook payload. Returns null when the event isn't reviewable
 * (closed without merge, draft, etc.).
 */
export function extractPRReview(
  event: string,
  payload: unknown,
): PRReviewRequest | null {
  if (event !== "pull_request") return null;
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  const action = String(p.action ?? "");
  if (
    !["opened", "synchronize", "reopened", "ready_for_review"].includes(action)
  ) {
    return null;
  }
  const pr = p.pull_request as Record<string, unknown> | undefined;
  const repo = p.repository as Record<string, unknown> | undefined;
  if (!pr || !repo) return null;
  if (pr.draft === true) return null;
  const headSha = (pr.head as Record<string, unknown> | undefined)?.sha;
  const number = pr.number;
  const repoFullName = repo.full_name;
  if (
    typeof headSha !== "string" ||
    typeof number !== "number" ||
    typeof repoFullName !== "string"
  ) {
    return null;
  }
  return {
    repoFullName,
    number,
    headSha,
    action: action as PullRequestAction,
  };
}

// ── Check-run shape ──────────────────────────────────────────────────────

/**
 * Build the JSON body for a check-run create / update call. Pure —
 * caller PUTs/POSTs it to `https://api.github.com/repos/.../check-runs`.
 */
export function buildCheckRun(req: CheckRunRequest): Record<string, unknown> {
  if (!req.name) throw new Error("buildCheckRun: name is required");
  if (!req.headSha) throw new Error("buildCheckRun: headSha is required");
  if (req.status === "completed" && !req.conclusion) {
    throw new Error(
      "buildCheckRun: conclusion is required when status=completed",
    );
  }
  const body: Record<string, unknown> = {
    name: req.name,
    head_sha: req.headSha,
    status: req.status,
  };
  if (req.conclusion) body.conclusion = req.conclusion;
  if (req.output) body.output = req.output;
  if (req.startedAt) body.started_at = new Date(req.startedAt).toISOString();
  if (req.completedAt)
    body.completed_at = new Date(req.completedAt).toISOString();
  return body;
}
