/**
 * Webhook idempotency — provider-agnostic dedupe wrapper.
 *
 * Every inbound webhook (PayPal, Stripe, Clerk, Yoco) is retried by
 * the provider on transient errors. Without dedupe, a retry can
 * double-charge a customer, double-create a tenant, or double-record
 * a delivery. The fix is to insert into `webhook_events` keyed by
 * `(provider, event_id)` BEFORE running side effects; if the insert
 * raises 23505 (unique violation), the event is a duplicate and we
 * short-circuit with 200 OK so the provider stops retrying.
 *
 * Usage in a webhook handler:
 *
 *   const fresh = await assertWebhookFresh({
 *     provider: "paypal",
 *     eventId: payload.id,
 *     eventType: payload.event_type,
 *   });
 *   if (!fresh.fresh) return fresh.duplicateResponse;
 *
 *   try {
 *     // ... do the side effects ...
 *     await markWebhookProcessed(fresh.handle, "ok");
 *     return NextResponse.json({ ok: true });
 *   } catch (err) {
 *     await markWebhookProcessed(fresh.handle, "failed", err);
 *     throw err;
 *   }
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { webhookEvents } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("webhook-idempotency");

export type WebhookProvider = "paypal" | "stripe" | "clerk" | "yoco";

export interface WebhookHandle {
  provider: WebhookProvider;
  eventId: string;
}

export interface FreshResult {
  fresh: true;
  handle: WebhookHandle;
}

export interface DuplicateResult {
  fresh: false;
  /** A pre-built 200 OK NextResponse — return this from the handler. */
  duplicateResponse: NextResponse;
}

/**
 * Insert a webhook fingerprint and report whether this is the first
 * time we've seen it. Always returns within ~50ms even when the DB
 * is unreachable — falls open (treats as fresh) so the handler
 * still runs. The trade: a single missed dedupe per outage is
 * preferable to dropping the event entirely.
 */
export async function assertWebhookFresh(args: {
  provider: WebhookProvider;
  eventId: string;
  eventType?: string | null;
}): Promise<FreshResult | DuplicateResult> {
  const { provider, eventId, eventType } = args;

  // Defensive — providers occasionally send empty event ids on
  // malformed retries. Treat as duplicate to avoid running side
  // effects against an unidentifiable event.
  if (!eventId) {
    log.warn("Webhook event missing event_id", { provider });
    return {
      fresh: false,
      duplicateResponse: NextResponse.json(
        { ok: true, deduped: true, reason: "missing event_id" },
        { status: 200 },
      ),
    };
  }

  try {
    await db.insert(webhookEvents).values({
      provider,
      eventId,
      eventType: eventType ?? null,
      status: "processing",
    });
    return { fresh: true, handle: { provider, eventId } };
  } catch (err) {
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "23505") {
      log.info("Webhook duplicate suppressed", { provider, eventId });
      return {
        fresh: false,
        duplicateResponse: NextResponse.json(
          { ok: true, deduped: true },
          { status: 200 },
        ),
      };
    }
    if (pgCode === "42P01") {
      // Migration 0021 not yet applied — fall open so webhooks still
      // process. Operator gets a single warn line per outage window.
      log.warn(
        "webhook_events table missing — apply migration 0021. Falling open.",
      );
      return { fresh: true, handle: { provider, eventId } };
    }
    log.warn("Webhook idempotency check failed — falling open", {
      provider,
      eventId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { fresh: true, handle: { provider, eventId } };
  }
}

/**
 * Mark an in-flight webhook as completed (or failed). Best-effort —
 * never throws. The audit trail is useful but not load-bearing.
 */
export async function markWebhookProcessed(
  handle: WebhookHandle,
  status: "ok" | "failed",
  error?: unknown,
): Promise<void> {
  try {
    await db
      .update(webhookEvents)
      .set({
        status,
        processedAt: sql`now()`,
        error:
          status === "failed"
            ? error instanceof Error
              ? error.message
              : error
                ? String(error)
                : null
            : null,
      })
      .where(
        and(
          eq(webhookEvents.provider, handle.provider),
          eq(webhookEvents.eventId, handle.eventId),
        ),
      );
  } catch {
    // Audit trail is non-critical — never block the webhook response.
  }
}
