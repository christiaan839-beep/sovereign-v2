/**
 * /api/receipts/trial — Self-serve API trial signup (Cook 163).
 *
 * Visitor → posts email → server-side generated 30-day API key
 * with a 10,000-receipt allotment. No sales call, no enterprise
 * pricing-page friction. Key is emailed back to the requester +
 * audit-logged to the founder.
 *
 * SECURITY:
 *   - Rate-limited 3 req/min/IP — trial signups are precious.
 *   - Zod-validated body; honeypot field.
 *   - API key is HMAC-signed under TRIAL_KEY_SECRET so the
 *     verifier can recognize valid trials without a DB read.
 *   - Trial keys expire 30 days from issuance; expiry is encoded
 *     in the key itself (base64url payload).
 *
 * Pure: doesn't write to the DB. The key is its own state via the
 * HMAC + expiry encoding. Caller wires a usage meter against the
 * key's subject id for the 10K receipt allotment.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { createHmac, randomBytes } from "crypto";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

const log = createLogger("receipts-trial");
const limiter = rateLimit({ interval: 60, limit: 3 });

const TRIAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TRIAL_QUOTA = 10_000;

const BODY = z.object({
  email: z.string().email().max(254),
  company: z.string().max(120).optional(),
  // Honeypot.
  website: z.string().max(0).optional(),
});

interface TrialKeyPayload {
  v: 1;
  sub: string; // subject id (random)
  email: string;
  issuedAt: number;
  expiresAt: number;
  quota: number;
}

function issueTrialKey(
  email: string,
  now: number,
): {
  key: string;
  payload: TrialKeyPayload;
} {
  const secret = process.env.TRIAL_KEY_SECRET;
  if (!secret) throw new Error("TRIAL_KEY_SECRET not configured");
  const payload: TrialKeyPayload = {
    v: 1,
    sub: `tr_${randomBytes(8).toString("hex")}`,
    email,
    issuedAt: now,
    expiresAt: now + TRIAL_TTL_MS,
    quota: TRIAL_QUOTA,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", secret).update(encoded).digest("base64url");
  return { key: `sk_trial_${encoded}.${mac}`, payload };
}

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  let body: z.infer<typeof BODY>;
  try {
    body = BODY.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (body.website && body.website.length > 0) {
    log.info("Trial honeypot triggered", { domain: body.email.split("@")[1] });
    return NextResponse.json({ ok: true });
  }

  if (!process.env.TRIAL_KEY_SECRET) {
    return NextResponse.json(
      {
        error:
          "Trial signup not yet configured. Email founder@sovereignmatrix.agency for early access.",
      },
      { status: 503 },
    );
  }

  const now = Date.now();
  let key: string;
  let payload: TrialKeyPayload;
  try {
    const out = issueTrialKey(body.email, now);
    key = out.key;
    payload = out.payload;
  } catch (err) {
    log.error("Trial key issuance failed", {
      err: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Could not issue trial key" },
      { status: 500 },
    );
  }

  // Email the key to the requester + the founder.
  const expiryDate = new Date(payload.expiresAt).toISOString().slice(0, 10);
  await sendTrialEmail({
    to: body.email,
    company: body.company,
    key,
    expiryDate,
    quota: payload.quota,
  });

  log.info("Trial issued", {
    sub: payload.sub,
    domain: body.email.split("@")[1],
    expiresAt: payload.expiresAt,
  });

  return NextResponse.json({
    ok: true,
    expiresAt: payload.expiresAt,
    quota: payload.quota,
    subjectId: payload.sub,
    message:
      "Your trial key is on its way. Check the inbox at " +
      body.email +
      " for the API key and quickstart.",
  });
}

async function sendTrialEmail(args: {
  to: string;
  company?: string;
  key: string;
  expiryDate: string;
  quota: number;
}): Promise<void> {
  const apiBase = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const sendUrl = apiBase ? `${apiBase}/api/_email/send` : "/api/_email/send";
  const founder =
    process.env.FOUNDER_NOTIFICATION_EMAIL ?? "founder@sovereignmatrix.agency";

  const html = renderTrialEmail(args);

  // Send to requester.
  await fetch(sendUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      to: args.to,
      subject: "Your Sovereign Matrix trial key (30 days · 10K receipts)",
      html,
      replyTo: founder,
    }),
  }).catch(() => {
    /* swallow */
  });

  // Send a copy to the founder for visibility.
  await fetch(sendUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      to: founder,
      subject: `[Trial signup] ${args.to}${args.company ? ` (${args.company})` : ""}`,
      html: `<p>Trial issued to <strong>${escape(args.to)}</strong>${args.company ? ` from <strong>${escape(args.company)}</strong>` : ""}.</p><p>Expires: ${args.expiryDate}</p>`,
    }),
  }).catch(() => {
    /* swallow */
  });
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&"
      ? "&amp;"
      : c === "<"
        ? "&lt;"
        : c === ">"
          ? "&gt;"
          : c === '"'
            ? "&quot;"
            : "&#39;",
  );
}

function renderTrialEmail(args: {
  to: string;
  key: string;
  expiryDate: string;
  quota: number;
}): string {
  return `<!doctype html>
<html><body style="font-family: ui-sans-serif, system-ui, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #111;">
  <h2 style="color: #06B6D4; font-size: 20px; margin-bottom: 8px;">Your Sovereign Matrix trial is live</h2>
  <p style="margin: 0 0 16px 0; color: #6b7280;">30 days · ${args.quota.toLocaleString()} receipts · expires ${args.expiryDate}</p>

  <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-top: 24px;">Your API key</h3>
  <pre style="background: #111827; color: #06B6D4; padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 12px; word-break: break-all;">${escape(args.key)}</pre>
  <p style="font-size: 12px; color: #6b7280; margin-top: 8px;">Keep this safe — it's the bearer token for your trial subject. Re-issue any time at sovereignmatrix.agency/starter-packs.</p>

  <h3 style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-top: 32px;">Quickstart</h3>
  <p style="font-size: 13px;">Sign your first receipt:</p>
  <pre style="background: #111827; color: #d1d5db; padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 12px;">curl -X POST https://sovereignmatrix.agency/api/receipts/sign \\
  -H "authorization: Bearer ${escape(args.key)}" \\
  -H "content-type: application/json" \\
  -d '{ "body": "your AI agent output", "agentSlug": "example" }'</pre>

  <p style="font-size: 13px; margin-top: 24px;">Verify any receipt:</p>
  <p style="font-size: 13px;"><a href="https://sovereignmatrix.agency/demo/verify-receipt" style="color: #06B6D4;">sovereignmatrix.agency/demo/verify-receipt</a></p>

  <p style="margin-top: 32px; font-size: 13px;">Reply to this email if anything's unclear. — Founder, Sovereign Matrix</p>
</body></html>`;
}
