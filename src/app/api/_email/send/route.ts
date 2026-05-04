import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { requireAuth } from "@/lib/auth-guard";
import { isAdmin } from "@/lib/admin-auth";
import { createLogger } from "@/lib/logger";
const log = createLogger("email-send");

export const maxDuration = 30;

/**
 * Universal Email Sender API
 *
 * Supports multiple providers with automatic fallback:
 * 1. Resend (primary — free tier: 100 emails/day)
 * 2. Nodemailer/Gmail (fallback)
 * 3. Console logging (development mode)
 *
 * Set RESEND_API_KEY in .env.local to activate Resend.
 * Set GMAIL_USER + GMAIL_APP_PASSWORD for Gmail fallback.
 */

interface EmailPayload {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
}

async function sendViaResend(
  payload: EmailPayload,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not configured");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from:
        payload.from ||
        process.env.RESEND_FROM_EMAIL ||
        "SOVEREIGN <noreply@umbra.ai>",
      to: [payload.to],
      subject: payload.subject,
      html: payload.html || undefined,
      text: payload.text || undefined,
      reply_to: payload.replyTo || undefined,
    }),
  });

  const data = await res.json();
  if (!res.ok)
    return { success: false, error: data.message || `HTTP ${res.status}` };
  return { success: true, id: data.id };
}

async function sendViaGmail(
  payload: EmailPayload,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error("Gmail credentials not configured");

  let nodemailer: typeof import("nodemailer");
  try {
    // Lazy require so the build doesn't fail when nodemailer isn't installed.
    // Mirrors the pattern used in src/lib/stripe.ts.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    nodemailer = require("nodemailer");
  } catch {
    return {
      success: false,
      error:
        "nodemailer is not installed — run `npm install nodemailer` to enable Gmail fallback",
    };
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  try {
    const info = await transporter.sendMail({
      from: payload.from || `SOVEREIGN <${user}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      replyTo: payload.replyTo,
    });
    return { success: true, id: info.messageId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

const emailLimiter = rateLimit({ interval: 60, limit: 10 }); // 10 emails per minute

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  // Admin-only: anyone with a Sovereign account would otherwise be able to
  // send arbitrary HTML email through our domain identity (phishing-from-our-
  // domain at 10/min). Server-side senders use src/lib/email.ts directly and
  // bypass this gate; this route exists for ops + admin tools only.
  if (!isAdmin(auth.userId)) {
    log.warn("Non-admin attempted /api/_email/send", { userId: auth.userId });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const limited = await emailLimiter.check(req);
    if (limited) return limited;

    const body = await req.json();
    const { to, subject, html, text, from, replyTo, template, data } = body;

    if (!to || !subject) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject" },
        { status: 400 },
      );
    }

    // If a template is specified, render it
    let emailHtml = html;
    const emailText = text;

    if (template && !html) {
      emailHtml = renderTemplate(template, data || {});
    }

    const payload: EmailPayload = {
      to,
      subject,
      html: emailHtml,
      text: emailText,
      from,
      replyTo,
    };

    // Try Resend first, then Gmail, then log
    let result;
    const provider = process.env.RESEND_API_KEY
      ? "resend"
      : process.env.GMAIL_USER
        ? "gmail"
        : "console";

    switch (provider) {
      case "resend":
        result = await sendViaResend(payload);
        break;
      case "gmail":
        result = await sendViaGmail(payload);
        break;
      default:
        result = { success: true, id: `console_${Date.now()}` };
    }

    // Don't echo provider error messages back — Gmail / SMTP errors can
    // include the SMTP user, host, or response headers. Log details
    // server-side and return a generic message to the caller.
    if (!result.success && result.error) {
      log.error("Email sender provider error", {
        provider,
        error: result.error,
      });
    }

    return NextResponse.json({
      success: result.success,
      provider,
      messageId: result.id || null,
      error: result.success ? null : "Email delivery failed",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error("Email sender error", { message });
    return NextResponse.json(
      { error: "Email delivery failed" },
      { status: 500 },
    );
  }
}

/**
 * Escape HTML special characters to prevent XSS in email templates.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Built-in branded SOVEREIGN email templates
 */
function renderTemplate(
  template: string,
  data: Record<string, string>,
): string {
  // Sanitize all data values before injecting into HTML
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    safe[key] = escapeHtml(String(value || ""));
  }
  const baseStyle = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; background: #0A0A0B; color: #E5E5E5; padding: 40px; max-width: 600px; margin: 0 auto;">
      <div style="border-bottom: 1px solid #1a1a1f; padding-bottom: 20px; margin-bottom: 30px;">
        <h1 style="font-size: 18px; letter-spacing: 0.3em; color: white; font-weight: 300; margin: 0;">SOVEREIGN</h1>
        <p style="font-size: 10px; letter-spacing: 0.2em; color: #666; text-transform: uppercase; margin: 4px 0 0;">Autonomous AI Marketing Intelligence</p>
      </div>
      <div>{{CONTENT}}</div>
      <div style="border-top: 1px solid #1a1a1f; padding-top: 20px; margin-top: 30px;">
        <p style="font-size: 11px; color: #444; margin: 0;">This is an automated notification from your SOVEREIGN node.</p>
      </div>
    </div>`;

  const templates: Record<string, string> = {
    welcome: `
      <h2 style="color: #00B7FF; font-weight: 300; font-size: 22px;">Welcome to Sovereign Matrix</h2>
      <p>Your account is active. All 130+ agents and 39+ models are ready to use.</p>
      <p>Account ID: <strong style="color: white;">${safe.nodeId || "UMB-NX-00000"}</strong></p>
      <a href="${safe.dashboardUrl || "#"}" style="display: inline-block; padding: 12px 30px; background: #00B7FF15; border: 1px solid #00B7FF30; color: #00B7FF; text-decoration: none; border-radius: 8px; font-size: 12px; letter-spacing: 0.15em; text-transform: uppercase; margin-top: 20px;">Open Dashboard →</a>`,

    payment_confirmed: `
      <h2 style="color: #10B981; font-weight: 300; font-size: 22px;">Payment Confirmed</h2>
      <p>Amount: <strong style="color: white;">${safe.amount || "R0"}</strong></p>
      <p>Plan: <strong style="color: white;">${safe.plan || "Sovereign"}</strong></p>
      <p>Your subscription is active. All agents and models are unlocked.</p>`,

    lead_alert: `
      <h2 style="color: #F97316; font-weight: 300; font-size: 22px;">New Lead Captured</h2>
      <p>Prospect: <strong style="color: white;">${safe.prospect || "Unknown"}</strong></p>
      <p>Source: <strong style="color: white;">${safe.source || "Outbound Engine"}</strong></p>
      <p>Estimated Value: <strong style="color: white;">${safe.value || "$0"}</strong></p>`,

    weekly_report: `
      <h2 style="color: #A855F7; font-weight: 300; font-size: 22px;">Weekly Intelligence Digest</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #1a1a1f; color: #666;">Leads Generated</td><td style="text-align: right; color: white; padding: 8px 0; border-bottom: 1px solid #1a1a1f;">${safe.leads || "0"}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #1a1a1f; color: #666;">Content Published</td><td style="text-align: right; color: white; padding: 8px 0; border-bottom: 1px solid #1a1a1f;">${safe.content || "0"}</td></tr>
        <tr><td style="padding: 8px 0; border-bottom: 1px solid #1a1a1f; color: #666;">Emails Sent</td><td style="text-align: right; color: white; padding: 8px 0; border-bottom: 1px solid #1a1a1f;">${safe.emails || "0"}</td></tr>
        <tr><td style="padding: 8px 0; color: #666;">Revenue</td><td style="text-align: right; color: #10B981; padding: 8px 0;">${safe.revenue || "R0"}</td></tr>
      </table>`,
  };

  const content =
    templates[template] || `<p>${safe.message || "No content available."}</p>`;
  return baseStyle.replace("{{CONTENT}}", content);
}
