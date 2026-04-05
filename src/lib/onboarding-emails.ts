import { createLogger } from "@/lib/logger";
import { sendEmail } from "@/lib/email";
import { getPublicUrl } from "@/lib/base-url";

const log = createLogger("onboarding-emails");

const BASE_URL = getPublicUrl();
const FROM_EMAIL = "Sovereign Matrix <noreply@sovereignmatrix.agency>";

// ── Email Template Wrapper ──

function wrap(body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:32px 16px;color:#e5e5e5;background:#0a0a0a">
  <div style="margin-bottom:24px">
    <strong style="color:#10b981;font-size:18px">SOVEREIGN MATRIX</strong>
  </div>
  ${body}
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #262626;font-size:12px;color:#737373">
    <a href="${BASE_URL}/unsubscribe" style="color:#737373">Unsubscribe</a>
  </div>
</body>
</html>`;
}

// ── Drip Sequence Definition ──

export interface DripEmail {
  dayOffset: number;
  subject: string;
  html: string;
}

export const DRIP_SEQUENCE: DripEmail[] = [
  // Day 0 — Welcome
  {
    dayOffset: 0,
    subject: "Your AI workspace is ready",
    html: wrap(`
      <p>Your workspace is live. Everything is set up and waiting for you.</p>
      <p>Here is a good first task to try: open the chat and type<br>
      <em>"Find 10 SaaS companies hiring marketers"</em></p>
      <p>The system will search, filter, and return results in about 10 seconds.</p>
      <a href="${BASE_URL}/dashboard" style="display:inline-block;padding:10px 20px;background:#10b981;color:#fff;text-decoration:none;border-radius:6px;margin-top:12px">Open Dashboard</a>
      <p style="margin-top:16px;color:#a3a3a3">Reply to this email if you have questions. A person will answer.</p>
    `),
  },

  // Day 1 — First Value
  {
    dayOffset: 1,
    subject: "Your first agent run",
    html: wrap(`
      <p>Three agents most people start with:</p>
      <p><strong>1. Lead Gen</strong> — describe your ideal customer, get a list with emails.<br>
      <a href="${BASE_URL}/dashboard/leads" style="color:#10b981">Open Lead Gen</a></p>
      <p><strong>2. Content</strong> — generate blog posts, emails, or social copy.<br>
      <a href="${BASE_URL}/dashboard/content-factory" style="color:#10b981">Open Content Factory</a></p>
      <p><strong>3. SEO</strong> — audit a page, find keyword gaps, generate meta tags.<br>
      <a href="${BASE_URL}/dashboard/settings" style="color:#10b981">Open SEO Tools</a></p>
      <p>Each one works from a single prompt. No setup required.</p>
    `),
  },

  // Day 3 — Workflows
  {
    dayOffset: 3,
    subject: "Save 10 hours this week",
    html: wrap(`
      <p>Workflows let you chain agents together so they run without you.</p>
      <p>Three examples that take under a minute to build:</p>
      <ul style="padding-left:18px;color:#d4d4d4">
        <li>Find leads, enrich emails, send to a Google Sheet</li>
        <li>Monitor a competitor site, summarize changes weekly</li>
        <li>Generate a blog post, create social variants, schedule them</li>
      </ul>
      <a href="${BASE_URL}/dashboard/workflow-builder" style="display:inline-block;padding:10px 20px;background:#10b981;color:#fff;text-decoration:none;border-radius:6px;margin-top:12px">Build a Workflow</a>
    `),
  },

  // Day 7 — Usage
  {
    dayOffset: 7,
    subject: "Your week in AI",
    html: wrap(`
      <p>You have been using your workspace for a week.</p>
      <p>On the free plan, you get 50 agent runs per day. Pro removes that limit and adds:</p>
      <ul style="padding-left:18px;color:#d4d4d4">
        <li>Unlimited agent runs</li>
        <li>Workflow scheduling (run agents on autopilot)</li>
        <li>Priority model routing (faster responses)</li>
      </ul>
      <p>No pressure. The free tier keeps working as long as you need it.</p>
      <a href="${BASE_URL}/pricing" style="display:inline-block;padding:10px 20px;background:#10b981;color:#fff;text-decoration:none;border-radius:6px;margin-top:12px">See Plans</a>
    `),
  },

  // Day 14 — Convert
  {
    dayOffset: 14,
    subject: "Your free tier — what's next",
    html: wrap(`
      <p>Two weeks in. Here is what Pro gives you beyond the free tier:</p>
      <ul style="padding-left:18px;color:#d4d4d4">
        <li>Unlimited runs across all 130+ agents</li>
        <li>Scheduled workflows that run while you sleep</li>
        <li>Voice agents for outbound calls</li>
        <li>White-label client dashboards</li>
      </ul>
      <p>If you are getting value from the platform, Pro pays for itself in the first week.</p>
      <a href="${BASE_URL}/pricing" style="display:inline-block;padding:10px 20px;background:#10b981;color:#fff;text-decoration:none;border-radius:6px;margin-top:12px">Upgrade to Pro</a>
    `),
  },
];

// ── Public API ──

/**
 * Send a specific drip email by index.
 * Returns true if the email was sent (or simulated) successfully.
 */
export async function sendOnboardingEmail(
  email: string,
  stepIndex: number
): Promise<boolean> {
  if (stepIndex < 0 || stepIndex >= DRIP_SEQUENCE.length) {
    log.warn("Invalid drip step index", { email, stepIndex });
    return false;
  }

  const step = DRIP_SEQUENCE[stepIndex];
  const result = await sendEmail({
    to: email,
    subject: step.subject,
    html: step.html,
    from: FROM_EMAIL,
  });

  log.info("Onboarding email attempted", {
    email,
    step: stepIndex,
    day: step.dayOffset,
    success: result.success,
  });

  return result.success;
}

/**
 * Get the drip email that should be sent for a user who signed up N days ago.
 * Returns the step index, or -1 if no email is due today.
 */
export function getStepForDay(daysSinceSignup: number): number {
  return DRIP_SEQUENCE.findIndex((s) => s.dayOffset === daysSinceSignup);
}

export function getSequenceLength(): number {
  return DRIP_SEQUENCE.length;
}

export function getStepDelay(index: number): number {
  return DRIP_SEQUENCE[index]?.dayOffset ?? 0;
}
