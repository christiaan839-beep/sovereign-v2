/**
 * POST /api/newsletter/subscribe
 *
 * Captures an email + optional source tag for the Sovereign newsletter.
 * Two-stage delivery (pure best-effort, never throws to the client):
 *
 *   1. If `RESEND_API_KEY` and `RESEND_AUDIENCE_ID` are configured,
 *      pushes the contact to that Resend audience (the canonical
 *      source of truth for outbound email).
 *   2. Always logs the signup to `audit_logs` so we have a server-
 *      side record even if Resend is unreachable, the env vars are
 *      missing, or the email is already on the list.
 *
 * Always returns 200 with `{ ok: true }` unless the email is
 * malformed. We don't differentiate "already subscribed" from
 * "newly added" to the caller — Resend handles dedup, and exposing
 * the distinction would be a subtle leak ("hmm, this email is on
 * your list").
 *
 * Rate-limited 10/min/IP via the shared limiter — keeps a hostile
 * loop from filling the audience.
 */

import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

const log = createLogger("newsletter/subscribe");

const limiter = rateLimit({ interval: 60, limit: 10 });

// RFC-ish minimal regex — enough to reject obvious garbage. Final
// validation happens at Resend.
import { outboundFetchAsResponse } from "@/lib/outbound-fetch";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const ALLOWED_SOURCES = new Set([
  "landing-footer",
  "affiliate-page",
  "spec-page",
  "verified-page",
  "explorer-page",
  "blog-post",
  "other",
]);

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  let email = "";
  let source: string | undefined;
  try {
    const body = (await req.json()) as { email?: unknown; source?: unknown };
    email = String(body.email ?? "")
      .trim()
      .toLowerCase()
      .slice(0, 320);
    if (typeof body.source === "string") {
      source = ALLOWED_SOURCES.has(body.source) ? body.source : "other";
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Provide a valid email address." },
      { status: 400 },
    );
  }

  // Push to Resend (best-effort, never throws to the caller).
  const resendKey = process.env.RESEND_API_KEY;
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (resendKey && audienceId) {
    try {
      const res = await outboundFetchAsResponse(`https://api.resend.com/audiences/${audienceId}/contacts`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, unsubscribed: false }),
        }, { ruleId: "newsletter.subscribe.route.1", allowedHosts: ["api.resend.com"] });
      if (!res.ok && res.status !== 409) {
        // 409 = already subscribed (Resend returns it). Anything else
        // is logged but not surfaced to the user.
        const text = await res.text().catch(() => "<no body>");
        log.warn("resend audience add failed", {
          status: res.status,
          body: text.slice(0, 300),
        });
      }
    } catch (err) {
      log.warn("resend audience network error", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  } else {
    log.info("newsletter signup (no Resend configured)", { source });
  }

  // Structured log so the signup is queryable in our log aggregator
  // (Sentry breadcrumb, Vercel log, etc.) even when Resend is offline
  // or the env vars aren't configured. Resend remains the canonical
  // outbound source of truth.
  log.info("newsletter subscribe", {
    email,
    source: source ?? "unknown",
    delivered_to_resend: !!(resendKey && audienceId),
  });

  return NextResponse.json({ ok: true });
}
