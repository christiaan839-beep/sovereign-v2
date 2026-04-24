/**
 * GET  /api/webhooks/subscriptions  — list the caller's subscriptions
 * POST /api/webhooks/subscriptions  — register a new subscription
 *
 * Completes the webhook story. The trigger endpoint (/api/agents/trigger/[slug])
 * exists but customers couldn't register a subscription to actually use it.
 *
 * Auth: Clerk session. Subscriptions are owned by the signed-in user's email.
 */

import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { webhookSubscriptions } from "@/db/schema";
import { requireAuth } from "@/lib/auth-guard";
import { generateWebhookSecret } from "@/lib/webhook-triggers";
import { createLogger } from "@/lib/logger";

const log = createLogger("webhooks-subscriptions");

/* ─── GET — list the caller's subscriptions ──────────────────── */

export async function GET(): Promise<Response> {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const rows = await db
      .select({
        id: webhookSubscriptions.id,
        label: webhookSubscriptions.label,
        agentSlug: webhookSubscriptions.agentSlug,
        callbackUrl: webhookSubscriptions.callbackUrl,
        isActive: webhookSubscriptions.isActive,
        triggerCount: webhookSubscriptions.triggerCount,
        failureCount: webhookSubscriptions.failureCount,
        lastTriggeredAt: webhookSubscriptions.lastTriggeredAt,
        createdAt: webhookSubscriptions.createdAt,
      })
      .from(webhookSubscriptions)
      .where(eq(webhookSubscriptions.ownerEmail, auth.email.toLowerCase()))
      .orderBy(desc(webhookSubscriptions.createdAt));

    return NextResponse.json(
      { ok: true, count: rows.length, subscriptions: rows },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    log.error("list subscriptions failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { ok: false, error: "query_failed" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

/* ─── POST — register a new subscription ─────────────────────── */

interface CreateBody {
  label?: unknown;
  agentSlug?: unknown;
  callbackUrl?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "bad_json" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const label = typeof body.label === "string" ? body.label.trim().slice(0, 100) : "";
  const agentSlug =
    typeof body.agentSlug === "string" ? body.agentSlug.trim().toLowerCase() : "";
  const callbackUrl =
    typeof body.callbackUrl === "string" ? body.callbackUrl.trim() : "";

  // Structured validation. Each field gets a distinct error code so
  // the UI can place the error message next to the right input.
  if (!label) {
    return NextResponse.json(
      { ok: false, error: "label_required" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!agentSlug) {
    return NextResponse.json(
      { ok: false, error: "agent_slug_required" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!/^https:\/\//.test(callbackUrl)) {
    // HTTPS only — HMAC over HTTP would be sent in cleartext, and
    // callback URLs often contain customer-identifying info.
    return NextResponse.json(
      { ok: false, error: "callback_url_must_be_https" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (callbackUrl.length > 500) {
    return NextResponse.json(
      { ok: false, error: "callback_url_too_long" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const secret = generateWebhookSecret();

  try {
    const [inserted] = await db
      .insert(webhookSubscriptions)
      .values({
        label,
        agentSlug,
        callbackUrl,
        secret,
        ownerEmail: auth.email.toLowerCase(),
        isActive: true,
      })
      .returning({
        id: webhookSubscriptions.id,
        createdAt: webhookSubscriptions.createdAt,
      });

    // Return the secret ONCE — caller must store it for HMAC.
    // This is the standard Stripe/GitHub pattern: "we never show
    // this secret again; copy it now."
    return NextResponse.json(
      {
        ok: true,
        subscription: {
          id: inserted.id,
          label,
          agentSlug,
          callbackUrl,
          secret,
          createdAt: inserted.createdAt,
        },
        notice:
          "This secret is shown ONCE — store it securely. The platform never displays it again.",
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    log.error("create subscription failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { ok: false, error: "insert_failed" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
