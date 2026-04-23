/**
 * Creator-facing email notifications.
 *
 * Three transactional messages:
 *   1. submission_received  — ack on SAM submit (curated flow)
 *   2. submission_approved  — admin approved + agent is live
 *   3. submission_rejected  — admin rejected with a reason
 *
 * Sends via Resend when RESEND_API_KEY is set. Without it, emails
 * degrade to a structured log line — the review loop still "works"
 * (reference ID + status url are visible in logs) but creators don't
 * get a real inbox notification. This means the admin dashboard is
 * never blocked by a missing env var during development.
 *
 * Plain text + HTML both sent. Plain text is the authoritative copy
 * for deliverability — Gmail + Outlook score pure-HTML emails harshly.
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("creator-emails");

const FROM_ADDRESS =
  process.env.RESEND_FROM_ADDRESS ??
  "Sovereign Matrix <no-reply@sovereignmatrix.agency>";

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://sovereignmatrix.agency";

/* ─── Types ───────────────────────────────────────────────────── */

export interface NotifyApprovedInput {
  to: string;
  displayName: string;
  slug: string | null;
  referenceId: string;
  reviewedBy?: string;
}

export interface NotifyRejectedInput {
  to: string;
  displayName: string;
  referenceId: string;
  reason: string;
  reviewedBy?: string;
}

export interface NotifySubmissionReceivedInput {
  to: string;
  displayName: string;
  referenceId: string;
  effectiveOutcome: "auto-publish" | "queue";
  liveUrl?: string;
}

/* ─── Resend transport ────────────────────────────────────────── */

interface ResendResult {
  sent: boolean;
  reason?: string;
}

async function sendViaResend(
  to: string,
  subject: string,
  text: string,
  html: string,
): Promise<ResendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    log.info("email_degraded_no_resend_key", { to, subject });
    return { sent: false, reason: "no_api_key" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to,
        subject,
        text,
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      log.error("resend_http_error", { status: res.status, body });
      return { sent: false, reason: `http_${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    log.error("resend_threw", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { sent: false, reason: "network" };
  }
}

/* ─── Messages ────────────────────────────────────────────────── */

export async function notifySubmissionReceived(
  input: NotifySubmissionReceivedInput,
): Promise<ResendResult> {
  const statusText =
    input.effectiveOutcome === "auto-publish"
      ? `Your agent is live at ${BASE_URL}${input.liveUrl ?? ""}`
      : "Your submission is queued for operator review (usually within 24h on business days).";

  const text = `We received your submission of "${input.displayName}".

Reference: ${input.referenceId}

${statusText}

You can check status at any time:
${BASE_URL}/creators/status/${input.referenceId}

— Sovereign Matrix
`;

  const html = renderHtml({
    title: `Submission received: ${input.displayName}`,
    body: `
      <p>We received your submission.</p>
      <p><strong>Reference:</strong> <code>${input.referenceId}</code></p>
      <p>${statusText}</p>
      <p><a href="${BASE_URL}/creators/status/${input.referenceId}">Check status</a></p>
    `,
  });

  return sendViaResend(
    input.to,
    `[Sovereign Matrix] Submission received — ${input.displayName}`,
    text,
    html,
  );
}

export async function notifyApproved(
  input: NotifyApprovedInput,
): Promise<ResendResult> {
  const liveUrl = input.slug
    ? `${BASE_URL}/marketplace/${input.slug}`
    : `${BASE_URL}/marketplace`;

  const text = `Your agent "${input.displayName}" is now live on the Sovereign Matrix marketplace.

Reference: ${input.referenceId}
Live URL: ${liveUrl}

Earnings start accruing on the next invocation. Dashboard:
${BASE_URL}/dashboard/earnings

— Sovereign Matrix
`;

  const html = renderHtml({
    title: `Approved: ${input.displayName} is live`,
    body: `
      <p>Your agent is now live on the marketplace.</p>
      <p><strong>Live URL:</strong> <a href="${liveUrl}">${liveUrl}</a></p>
      <p><strong>Reference:</strong> <code>${input.referenceId}</code></p>
      <p><a href="${BASE_URL}/dashboard/earnings">Track earnings</a></p>
    `,
  });

  return sendViaResend(
    input.to,
    `[Sovereign Matrix] Approved — ${input.displayName} is live`,
    text,
    html,
  );
}

export async function notifyRejected(
  input: NotifyRejectedInput,
): Promise<ResendResult> {
  const text = `Your submission "${input.displayName}" was not approved.

Reference: ${input.referenceId}
Reason: ${input.reason}

You can revise and resubmit:
${BASE_URL}/creators/apply

— Sovereign Matrix
`;

  const html = renderHtml({
    title: `Not approved: ${input.displayName}`,
    body: `
      <p>Your submission was not approved.</p>
      <p><strong>Reference:</strong> <code>${input.referenceId}</code></p>
      <p><strong>Reason:</strong> ${escapeHtml(input.reason)}</p>
      <p><a href="${BASE_URL}/creators/apply">Revise and resubmit →</a></p>
    `,
  });

  return sendViaResend(
    input.to,
    `[Sovereign Matrix] Not approved — ${input.displayName}`,
    text,
    html,
  );
}

/* ─── Tiny HTML shell (no deps) ───────────────────────────────── */

function renderHtml({ title, body }: { title: string; body: string }): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 40px auto; padding: 24px; color: #111; line-height: 1.55;">
  <h1 style="font-size: 20px; font-weight: 600; margin: 0 0 16px 0;">${escapeHtml(title)}</h1>
  ${body}
  <hr style="border: 0; border-top: 1px solid #eee; margin: 24px 0;" />
  <p style="font-size: 12px; color: #888;">Sovereign Matrix · <a href="${BASE_URL}" style="color: #888;">sovereignmatrix.agency</a></p>
</body></html>`;
}

/**
 * Tiny HTML escape — no dep needed. Handles the 5 XML-reserved chars.
 * Safe for use with user-supplied strings (reject reasons, names).
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
