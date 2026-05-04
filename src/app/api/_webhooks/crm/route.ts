import { NextResponse } from "next/server";
import crypto from "crypto";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { alreadyProcessed } from "@/lib/idempotency";
import { db } from "@/db";
import { users, playbookRuns, leads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendEmail } from "@/lib/email";
import { auditLog } from "@/lib/audit-log";

const log = createLogger("crm-webhook");

/** Minimal HTML escape for interpolating untrusted strings into an email body. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** HubSpot v3 webhook event shape (subset we care about). */
interface HubSpotEvent {
  eventId?: number | string;
  subscriptionType?: string;
  propertyName?: string;
  propertyValue?: string;
  objectId?: number | string;
  occurredAt?: number;
  // HubSpot enriches with associated contact email when configured.
  // Properties carrying owner/contact email vary by integration; we read the
  // most common ones defensively.
  email?: string;
  contactEmail?: string;
  ownerEmail?: string;
  dealName?: string;
  amount?: number | string;
}

/**
 * Resolve a Sovereign user from a HubSpot event. Tries every email field
 * the webhook might carry; returns null if none match a registered user.
 */
async function resolveUserFromEvent(
  ev: HubSpotEvent,
): Promise<{ id: string; email: string; name: string } | null> {
  // SECURITY: only trust the deal-owner email. `email` and `contactEmail`
  // come from contact records that anyone with HubSpot access (including
  // partners and form submissions) can populate — using them to resolve a
  // Sovereign user is account-takeover-adjacent. The deal owner is set by
  // an authenticated HubSpot seat, so it's the only trustworthy field.
  const ownerEmail =
    typeof ev.ownerEmail === "string" && ev.ownerEmail.includes("@")
      ? ev.ownerEmail.toLowerCase()
      : null;
  if (!ownerEmail) return null;
  try {
    const [row] = await db
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.email, ownerEmail))
      .limit(1);
    return row ?? null;
  } catch {
    // users table missing in dev — bail out cleanly
    return null;
  }
}

/**
 * Trigger the post-close automation for a Sovereign user: log a
 * playbook_runs entry, file a `closed` lead row, and send the welcome /
 * contract email. All steps are best-effort — we never fail the webhook
 * because of a downstream side-effect failure (HubSpot would retry).
 */
async function triggerCloseWonAutomation(
  user: { id: string; email: string; name: string },
  ev: HubSpotEvent,
): Promise<void> {
  const runId = crypto.randomUUID();
  const dealName = ev.dealName ?? `Deal ${ev.objectId ?? ""}`.trim();

  // 1. Persist a playbook run for dashboard visibility.
  try {
    await db.insert(playbookRuns).values({
      id: runId,
      userId: user.id,
      playbookId: "crm-onboarding",
      playbookName: "CRM Closed-Won Onboarding",
      inputs: JSON.stringify({
        source: "hubspot",
        eventId: ev.eventId,
        objectId: ev.objectId,
        dealName,
        amount: ev.amount,
      }),
      status: "running",
      stepCount: 2,
    });
  } catch (err) {
    log.warn("playbookRuns insert skipped (table missing?)", {
      error: String(err),
    });
  }

  // 2. Mirror the closed deal as a lead row so it shows in the CRM tab.
  try {
    await db.insert(leads).values({
      userEmail: user.email,
      name: dealName,
      email: user.email,
      businessName: dealName,
      source: "hubspot",
      status: "closed",
      notes: `Auto-imported from HubSpot Closed Won (eventId=${ev.eventId ?? "n/a"})`,
    });
  } catch (err) {
    log.warn("leads insert skipped", { error: String(err) });
  }

  // 3. Send the contract / onboarding email directly (no Clerk loopback).
  let emailSucceeded = false;
  // Escape interpolations — dealName originates from HubSpot input that
  // a deal-owner can shape, so treat it as untrusted in HTML context.
  const safeName = escapeHtml(user.name || "there");
  const safeDealName = escapeHtml(dealName);
  try {
    const result = await sendEmail({
      to: user.email,
      subject: `Welcome aboard — ${dealName} is signed`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; background:#0A0A0B; color:#E5E5E5; padding:40px; max-width:600px; margin:0 auto;">
          <h1 style="font-size:18px; letter-spacing:.3em; color:#fff; font-weight:300;">SOVEREIGN</h1>
          <p style="font-size:11px; letter-spacing:.2em; color:#666; text-transform:uppercase; margin:4px 0 24px;">Onboarding Notice</p>
          <h2 style="color:#10B981; font-weight:300;">Your contract is active.</h2>
          <p>Hi ${safeName},</p>
          <p>We received the closed-won signal for <strong style="color:#fff;">${safeDealName}</strong> from your CRM. Your Sovereign workspace is provisioning the agents tied to this engagement now.</p>
          <p>Next 24 hours: kickoff packet, project channel, and the first agent runs land in your dashboard.</p>
          <a href="https://sovereignmatrix.agency/dashboard" style="display:inline-block; padding:12px 30px; background:#00B7FF15; border:1px solid #00B7FF30; color:#00B7FF; text-decoration:none; border-radius:8px; font-size:12px; letter-spacing:.15em; text-transform:uppercase; margin-top:20px;">Open Dashboard →</a>
          <p style="font-size:11px; color:#444; margin-top:30px;">This message was triggered automatically by your HubSpot integration.</p>
        </div>`,
    });
    emailSucceeded = result.success === true;
    if (!emailSucceeded) {
      log.warn("Onboarding email not sent", { reason: result.error });
    }
  } catch (err) {
    log.warn("Onboarding email threw", { error: String(err) });
  }

  // 4. Close out the playbook run.
  try {
    await db
      .update(playbookRuns)
      .set({
        status: emailSucceeded ? "done" : "failed",
        stepsSucceeded: emailSucceeded ? 2 : 1,
        stepsFailed: emailSucceeded ? 0 : 1,
        completedAt: new Date(),
      })
      .where(eq(playbookRuns.id, runId));
  } catch {
    /* non-blocking */
  }

  await auditLog({
    userId: user.id,
    action: "webhook.received",
    resource: `hubspot:closedwon:${ev.objectId ?? ev.eventId ?? "unknown"}`,
    details: {
      eventId: ev.eventId,
      dealName,
      emailSent: emailSucceeded,
    },
  });
}

/**
 * SOVEREIGN MATRIX CRM WEBHOOK LAYER
 *
 * Receives state changes directly from HubSpot and Salesforce.
 * E.g., When a human sales rep moves a Deal to "Closed Won", this webhook triggers
 * the autonomous agent swarm to generate contracts and onboard the client via email.
 *
 * SECURITY: Requires HubSpot HMAC-SHA256 v3 signature verification. Without
 * the configured HUBSPOT_CLIENT_SECRET env var the endpoint returns 503 —
 * we never silently accept unauthenticated webhooks (they could be used to
 * trigger autonomous agent swarms and burn LLM costs / leak data).
 *
 * HubSpot signature docs:
 * https://developers.hubspot.com/docs/api/webhooks/validating-requests
 */

const limiter = rateLimit({ interval: 60, limit: 30 });

/**
 * Verify HubSpot v3 webhook signature.
 * v3 = base64(HMAC-SHA256(secret, METHOD + URL + BODY + TIMESTAMP))
 */
function verifyHubSpotSignature(
  signature: string,
  secret: string,
  method: string,
  url: string,
  body: string,
  timestamp: string,
): boolean {
  // Reject stale requests (replay protection) — HubSpot recommends 5 min.
  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return false;
  const ageMs = Date.now() - ts;
  if (ageMs > 5 * 60 * 1000 || ageMs < -30 * 1000) return false;

  const source = `${method}${url}${body}${timestamp}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(source)
    .digest("base64");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const secret = process.env.HUBSPOT_CLIENT_SECRET;
  if (!secret) {
    log.error("HUBSPOT_CLIENT_SECRET not configured — rejecting webhook");
    return NextResponse.json(
      { error: "CRM webhook not configured" },
      { status: 503 },
    );
  }

  const signature = req.headers.get("x-hubspot-signature-v3");
  const timestamp = req.headers.get("x-hubspot-request-timestamp");
  if (!signature || !timestamp) {
    return NextResponse.json(
      { error: "Missing signature headers" },
      { status: 401 },
    );
  }

  // Read raw body for signature verification — req.json() would consume it.
  const rawBody = await req.text();

  if (
    !verifyHubSpotSignature(
      signature,
      secret,
      "POST",
      req.url,
      rawBody,
      timestamp,
    )
  ) {
    log.error("Invalid HubSpot signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: HubSpotEvent | HubSpotEvent[];
  try {
    payload = JSON.parse(rawBody) as HubSpotEvent | HubSpotEvent[];
  } catch (error) {
    log.error("CRM webhook parsing error", error as Record<string, unknown>);
    return NextResponse.json(
      { error: "Failed to parse CRM state mutation" },
      { status: 400 },
    );
  }

  // HubSpot batches events into an array; single events are also valid.
  const events = Array.isArray(payload) ? payload : [payload];

  let triggered = 0;
  let skipped = 0;

  for (const ev of events) {
    // Per-event idempotency — HubSpot retries on 5xx, so dedup by eventId.
    const dedupKey = String(
      ev.eventId ?? `${ev.subscriptionType}:${ev.objectId}:${ev.occurredAt}`,
    );
    if (await alreadyProcessed("hubspot:event", dedupKey)) {
      skipped++;
      continue;
    }

    // Only react to deal-stage transitions into closed-won.
    const isDealStageChange =
      ev.subscriptionType === "deal.propertyChange" &&
      ev.propertyName === "dealstage";
    const isClosedWon =
      typeof ev.propertyValue === "string" &&
      ev.propertyValue.toLowerCase().includes("closedwon");

    if (!isDealStageChange || !isClosedWon) {
      skipped++;
      continue;
    }

    const user = await resolveUserFromEvent(ev);
    if (!user) {
      log.warn("HubSpot closed-won received but no Sovereign user matched", {
        eventId: ev.eventId,
      });
      skipped++;
      continue;
    }

    try {
      await triggerCloseWonAutomation(user, ev);
      triggered++;
    } catch (err) {
      // Already logged inside the trigger; keep webhook successful so HubSpot
      // doesn't infinitely retry on a single bad downstream call.
      log.error("triggerCloseWonAutomation failed", {
        eventId: ev.eventId,
        error: String(err),
      });
      skipped++;
    }
  }

  return NextResponse.json({
    success: true,
    status: "ok",
    received: events.length,
    triggered,
    skipped,
  });
}
