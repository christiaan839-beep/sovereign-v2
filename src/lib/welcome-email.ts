/**
 * Welcome email — fired the moment an operator hits "Provision" on
 * /admin/onboard. The customer receives a short personalised note
 * with their welcome URL within ~2 seconds.
 *
 * Why an email at all (vs Slack/SMS):
 *   - The customer's calendar inbox is the most reliably-checked
 *     surface across founders. Slack DMs are ignored from strangers.
 *   - The email lets them forward the welcome URL to a cofounder.
 *   - It creates a paper trail in the customer's inbox — when they
 *     come back next week wondering "did I have a kickoff scheduled?"
 *     they search "Sovereign" and find the answer.
 *
 * Failure mode: if Resend is unavailable or RESEND_API_KEY is unset,
 * the function returns `{ ok: false, reason }` and the caller logs
 * a warning but still returns success on the onboarding endpoint —
 * a missing email never blocks provisioning. The operator can resend
 * manually from the admin page (planned: a "Resend welcome email"
 * button on /admin/customers).
 */

import { captureException } from "@/lib/sentry";
import { createLogger } from "@/lib/logger";

const log = createLogger("welcome-email");

export interface WelcomeEmailInput {
  /** Customer's email address — required, validated upstream. */
  to: string;
  /** Customer's first name as captured during onboarding. */
  firstName: string;
  /** Public welcome URL (`/welcome/[id]`). */
  welcomeUrl: string;
  /** Kickoff Calendly URL — same one stored on the tenant row. */
  kickoffUrl: string;
  /** ISO YYYY-MM-DD — Monday of first delivery. */
  firstDelivery: string;
  /** From-name to use in the email envelope. Defaults to operator. */
  fromName?: string;
}

interface SendResult {
  ok: boolean;
  id?: string;
  reason?: string;
}

const FROM_DEFAULT =
  process.env.RESEND_FROM_EMAIL ||
  "Sovereign Matrix <welcome@sovereignmatrix.agency>";

function formatDeliveryDate(yyyymmdd: string): string {
  return new Date(yyyymmdd + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function htmlBody(args: WelcomeEmailInput): string {
  const deliveryReadable = formatDeliveryDate(args.firstDelivery);
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#030303;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e5e5e5;line-height:1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#030303;padding:40px 20px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr><td style="padding-bottom:24px;">
          <span style="font-size:11px;font-weight:600;letter-spacing:3px;color:#10b981;text-transform:uppercase;">Sovereign Matrix</span>
        </td></tr>
        <tr><td>
          <h1 style="margin:0 0 24px;font-size:32px;line-height:1.2;color:#ffffff;font-weight:700;">Welcome, ${escapeHtml(args.firstName)}.</h1>
          <p style="margin:0 0 18px;font-size:16px;color:#d4d4d4;">You hired a person, not a SaaS. Here&rsquo;s what happens next.</p>
          <p style="margin:0 0 24px;font-size:16px;color:#d4d4d4;">Open your personal welcome page. There&rsquo;s a 60-second video from me on it explaining the rest. The URL is unguessable — keep it private if you want, share it with your cofounder if useful.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 32px;"><tr><td style="border-radius:9999px;background:#10b981;">
            <a href="${args.welcomeUrl}" style="display:inline-block;padding:14px 28px;font-size:14px;font-weight:600;color:#000;text-decoration:none;border-radius:9999px;">
              Open your welcome page &rarr;
            </a>
          </td></tr></table>
          <p style="margin:0 0 12px;font-size:14px;color:#a3a3a3;">The short version of what&rsquo;s on that page:</p>
          <ul style="margin:0 0 28px;padding-left:20px;font-size:14px;color:#d4d4d4;">
            <li style="margin-bottom:8px;">A 60-second video walkthrough.</li>
            <li style="margin-bottom:8px;"><a href="${args.kickoffUrl}" style="color:#10b981;text-decoration:underline;">Book your 30-min kickoff call</a> &mdash; we define your ICP together.</li>
            <li style="margin-bottom:8px;">A private Slack channel where I reply within 1 hour during business hours.</li>
            <li style="margin-bottom:8px;">First batch of 50 qualified leads in your inbox: <strong style="color:#ffffff;">${deliveryReadable}, 9am your timezone.</strong></li>
          </ul>
          <p style="margin:0 0 8px;font-size:14px;color:#a3a3a3;">What I hold myself to:</p>
          <ul style="margin:0 0 28px;padding-left:20px;font-size:13px;color:#a3a3a3;">
            <li>Every lead is hand-reviewed before it ships.</li>
            <li>Every Slack message gets a reply within 1 hour during business hours.</li>
            <li>Monday delivery is sacred. Miss it, the month is on us.</li>
            <li>Money back, no friction, same day &mdash; if your first month falls short of 50 leads.</li>
          </ul>
          <p style="margin:0 0 8px;font-size:14px;color:#d4d4d4;">Talk soon.</p>
          <p style="margin:0;font-size:14px;color:#d4d4d4;">&mdash; ${escapeHtml(args.fromName ?? "Sovereign Matrix")}</p>
        </td></tr>
        <tr><td style="padding-top:48px;border-top:1px solid #262626;margin-top:48px;">
          <p style="margin:0;font-size:11px;color:#525252;line-height:1.6;">
            This email was sent because you signed up for Sovereign Lead Engine.
            Your welcome URL is unique to you and never expires &mdash; bookmark it.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function textBody(args: WelcomeEmailInput): string {
  return `Welcome, ${args.firstName}.

You hired a person, not a SaaS. Here's what happens next.

Open your welcome page (60-sec video + next steps):
${args.welcomeUrl}

What you'll see there:
  - A 60-second video walkthrough
  - Book your 30-min kickoff call: ${args.kickoffUrl}
  - A private Slack channel
  - First batch of 50 leads on Monday ${formatDeliveryDate(args.firstDelivery)} at 9am your timezone

What I hold myself to:
  - Every lead is hand-reviewed before it ships
  - Slack reply within 1 hour during business hours
  - Monday delivery sacred — miss it, the month is on us
  - Money back, no friction, same day — fewer than 50 leads in your first 30 days

Talk soon.
— ${args.fromName ?? "Sovereign Matrix"}
`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendWelcomeEmail(
  args: WelcomeEmailInput,
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    log.warn("RESEND_API_KEY missing — welcome email skipped", {
      to: args.to,
    });
    return { ok: false, reason: "RESEND_API_KEY missing" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_DEFAULT,
        to: [args.to],
        subject: `Welcome to Sovereign Lead Engine, ${args.firstName}`,
        html: htmlBody(args),
        text: textBody(args),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
    };
    if (!res.ok) {
      const reason = data.message || `HTTP ${res.status}`;
      captureException(new Error(`Resend send failed: ${reason}`), {
        module: "welcome-email",
        action: "send",
        extra: { to: args.to, status: res.status },
      });
      return { ok: false, reason };
    }
    log.info("Welcome email sent", { to: args.to, id: data.id });
    return { ok: true, id: data.id };
  } catch (err) {
    captureException(err, {
      module: "welcome-email",
      action: "send",
      extra: { to: args.to },
    });
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
