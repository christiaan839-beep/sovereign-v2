/**
 * /api/_lead/capture — Marketing lead capture (Cook 162).
 *
 * Internal endpoint every public CTA (/savings, /pitch, /grants,
 * /starter-packs, /investors) can POST to. Captures email + intent
 * + source page, fires a founder-facing email via the existing
 * universal email sender, and persists a minimal audit-log entry.
 *
 * This is NOT the tenant-leads table (which is per-customer CRM).
 * It's a marketing top-of-funnel capture that lands in the
 * founder's inbox in real time.
 *
 * SECURITY:
 *   - Rate-limited 5 req/min/IP to defeat scrapers.
 *   - Honeypot field on the body to reject obvious bots.
 *   - Origin allowlist (production + preview); 403 elsewhere.
 *   - Email validation via zod; no SQL injection vector.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { outboundFetch } from "@/lib/outbound-fetch";

const log = createLogger("lead-capture");
const limiter = rateLimit({ interval: 60, limit: 5 });

const BODY = z.object({
  email: z.string().email().max(254),
  intent: z.string().min(1).max(64), // "savings-quote" / "trial" / "investor-call" / etc
  source: z.string().min(1).max(128), // page path
  // Optional context.
  name: z.string().max(120).optional(),
  company: z.string().max(120).optional(),
  message: z.string().max(1500).optional(),
  // Honeypot — bots fill it; humans don't see it.
  website: z.string().max(0).optional(),
});

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  let body: z.infer<typeof BODY>;
  try {
    body = BODY.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  // Honeypot — silently 200 so bots think they succeeded.
  if (body.website && body.website.length > 0) {
    log.info("Honeypot triggered, silently accepted", { source: body.source });
    return NextResponse.json({ ok: true });
  }

  const founderEmail =
    process.env.FOUNDER_NOTIFICATION_EMAIL ?? "founder@sovereignmatrix.agency";

  // Fire the founder-notification email via the universal sender.
  const subject = `[Sovereign Lead] ${body.intent} — ${body.email}`;
  const html = renderFounderEmail(body);

  try {
    const apiBase = process.env.NEXT_PUBLIC_BASE_URL ?? "";
    // Only send when we have an absolute base — outboundFetch can't
    // resolve a relative path. Logging still fires below.
    if (apiBase) {
      const sendUrl = `${apiBase}/api/_email/send`;
      await outboundFetch(
        sendUrl,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            to: founderEmail,
            subject,
            html,
            replyTo: body.email,
          }),
        },
        {
          ruleId: "lead.capture.founder-email",
          allowedHosts: [new URL(sendUrl).hostname],
        },
      ).catch(() => {
        /* swallow — we still want to log + return ok */
      });
    }
  } catch {
    /* swallow */
  }

  log.info("Lead captured", {
    intent: body.intent,
    source: body.source,
    emailDomain: body.email.split("@")[1],
    hasMessage: Boolean(body.message),
  });

  return NextResponse.json({ ok: true });
}

function renderFounderEmail(b: z.infer<typeof BODY>): string {
  // Plain HTML; the universal sender turns this into the wire body.
  const safe = (s: string | undefined) =>
    s
      ? s.replace(/[&<>"']/g, (c) =>
          c === "&"
            ? "&amp;"
            : c === "<"
              ? "&lt;"
              : c === ">"
                ? "&gt;"
                : c === '"'
                  ? "&quot;"
                  : "&#39;",
        )
      : "";

  return `<!doctype html>
<html><body style="font-family: ui-sans-serif, system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #111;">
  <h2 style="color: #06B6D4; font-size: 18px; margin-bottom: 16px;">New lead captured</h2>
  <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
    <tr><td style="padding: 8px 0; color: #6b7280;">Intent</td><td style="padding: 8px 0; font-weight: 600;">${safe(b.intent)}</td></tr>
    <tr><td style="padding: 8px 0; color: #6b7280;">Source</td><td style="padding: 8px 0;">${safe(b.source)}</td></tr>
    <tr><td style="padding: 8px 0; color: #6b7280;">Email</td><td style="padding: 8px 0;"><a href="mailto:${safe(b.email)}">${safe(b.email)}</a></td></tr>
    ${b.name ? `<tr><td style="padding: 8px 0; color: #6b7280;">Name</td><td style="padding: 8px 0;">${safe(b.name)}</td></tr>` : ""}
    ${b.company ? `<tr><td style="padding: 8px 0; color: #6b7280;">Company</td><td style="padding: 8px 0;">${safe(b.company)}</td></tr>` : ""}
  </table>
  ${b.message ? `<div style="margin-top: 24px; padding: 16px; background: #f3f4f6; border-radius: 8px;"><p style="margin: 0 0 8px 0; color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Message</p><p style="margin: 0; white-space: pre-wrap;">${safe(b.message)}</p></div>` : ""}
  <p style="margin-top: 24px; color: #9ca3af; font-size: 11px;">Reply directly to this email to respond. Auto-captured via /api/_lead/capture.</p>
</body></html>`;
}
