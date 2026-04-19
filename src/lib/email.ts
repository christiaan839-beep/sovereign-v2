/**
 * Email Delivery — Resend Integration
 *
 * Graceful fallback: if RESEND_API_KEY is not set, logs emails instead of failing.
 * Add RESEND_API_KEY to Vercel env vars to enable real delivery.
 *
 * Free tier: 100 emails/day at resend.com
 */

import { createLogger } from "@/lib/logger";
const log = createLogger("email");

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
  simulated?: boolean;
}

export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const { to, subject, html, from, replyTo } = options;

  // Validate inputs
  if (!to || !subject || !html) {
    return { success: false, error: "Missing required fields: to, subject, html" };
  }

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    log.warn("RESEND_API_KEY not configured — email NOT sent", { to, subject });
    return { success: false, error: "Email service not configured (RESEND_API_KEY missing)", simulated: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      // Hard 8s timeout — Resend p99 ~2s; prevents Vercel function hangs.
      signal: AbortSignal.timeout(8_000),
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: from || "SOVEREIGN <noreply@umbra.ai>",
        to: [to],
        subject,
        html,
        reply_to: replyTo,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      log.error("Resend API error", { status: res.status, message: data.message });
      return { success: false, error: data.message || "Failed to send" };
    }

    return { success: true, id: data.id };
  } catch (err) {
    log.error("Email send failed", { error: err instanceof Error ? err.message : "unknown" });
    return { success: false, error: "Network error" };
  }
}

/**
 * Send a sequence of emails with delays.
 * In production, this would use a job queue (Bull, Inngest, etc.)
 * For now, sends the first email immediately and logs the rest.
 */
export async function sendSequence(
  emails: { to: string; subject: string; html: string; delayDays: number }[]
): Promise<{ sent: number; queued: number }> {
  let sent = 0;
  let queued = 0;

  for (const email of emails) {
    if (email.delayDays === 0 || sent === 0) {
      // Send immediately
      const result = await sendEmail(email);
      if (result.success) sent++;
    } else {
      // Log for future delivery (would use job queue in production)
      log.debug("Email queued for future delivery", { delayDays: email.delayDays, subject: email.subject, to: email.to });
      queued++;
    }
  }

  return { sent, queued };
}
