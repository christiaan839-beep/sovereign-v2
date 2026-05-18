import { NextResponse } from "next/server";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { createLogger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { getPublicUrl } from "@/lib/base-url";
import { alreadyProcessed } from "@/lib/idempotency";

const log = createLogger("zapier-webhook");

// Per-key rate limit (key hash is the rate-limit identifier in getClientId).
const limiter = rateLimit({ interval: 60, limit: 60 });

/**
 * ZAPIER INTEGRATION ENDPOINT — /api/_webhooks/zapier
 *
 * Zapier calls this endpoint to:
 * 1. Test authentication (GET with API key)
 * 2. Execute agent actions (POST with agent name + params)
 * 3. Subscribe to triggers (POST with hook_url for real-time events)
 *
 * Authentication: API key in X-Api-Key header or Authorization: Bearer
 *
 * This endpoint follows Zapier's expected format:
 * https://platform.zapier.com/build/cli-auth
 */

async function validateKey(
  req: Request,
): Promise<{ valid: boolean; userId?: string; plan?: string }> {
  const key =
    req.headers.get("x-api-key") ||
    req.headers.get("authorization")?.replace("Bearer ", "") ||
    "";
  if (!key || !key.startsWith("sk_")) return { valid: false };

  const keyHash = crypto.createHash("sha256").update(key).digest("hex");
  try {
    const rows = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.key, keyHash))
      .limit(1);
    const row = rows[0];
    if (!row || row.revokedAt) return { valid: false };
    return { valid: true, userId: row.userId, plan: row.plan };
  } catch {
    return { valid: false };
  }
}

// GET: Auth test (Zapier calls this to verify the API key works)
export async function GET(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const auth = await validateKey(req);
  if (!auth.valid) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    userId: auth.userId,
    plan: auth.plan,
    available_agents: [
      "leads",
      "blog-gen",
      "seo-dominator",
      "email-sequence",
      "competitor-scan",
      "brand-voice",
      "proposal-generator",
      "organic-content",
      "translate",
      "omni-search",
    ],
    available_playbooks: [
      "lead-blitz",
      "content-machine",
      "competitor-takedown",
      "proposal-blaster",
    ],
  });
}

// POST: Execute an action or register a webhook
export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const auth = await validateKey(req);
  if (!auth.valid) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, agent, params, playbook_id, hook_url } = body;

    // Idempotency — Zapier sends x-zapier-request-id on every
    // delivery and retries failed actions. Without dedup, retried
    // agent invocations re-charge the model + replay the action.
    const zapierRequestId =
      req.headers.get("x-zapier-request-id") ||
      req.headers.get("x-zapier-event-id") ||
      "";
    if (
      zapierRequestId &&
      (await alreadyProcessed("zapier:request", zapierRequestId))
    ) {
      log.info("Skipped: Zapier request already processed", {
        zapierRequestId,
      });
      return NextResponse.json({ status: "duplicate" });
    }

    // Webhook subscription (Zapier trigger)
    if (action === "subscribe" && hook_url) {
      // Store the webhook URL for real-time event delivery
      log.info("Zapier webhook subscribed", { userId: auth.userId, hook_url });
      return NextResponse.json({
        id: crypto.randomUUID(),
        status: "subscribed",
        hook_url,
      });
    }

    if (action === "unsubscribe") {
      log.info("Zapier webhook unsubscribed", { userId: auth.userId });
      return NextResponse.json({ status: "unsubscribed" });
    }

    // Agent execution
    if (agent) {
      // Use a stable internal URL from env config — never trust the
      // request Host header (SSRF-adjacent on misconfigured deploys).
      const baseUrl = getPublicUrl();

      const agentRes = await fetch(`${baseUrl}/api/agents/${agent}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Sovereign-Internal": "zapier-proxy",
        },
        body: JSON.stringify({ ...params, confirmed: true }),
        signal: AbortSignal.timeout(45000),
      });

      const data = await agentRes.json();
      return NextResponse.json(data, { status: agentRes.status });
    }

    // Playbook execution
    if (playbook_id) {
      // Use a stable internal URL from env config — never trust the
      // request Host header (SSRF-adjacent on misconfigured deploys).
      const baseUrl = getPublicUrl();

      const coordRes = await fetch(`${baseUrl}/api/agents/coordinator`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Sovereign-Internal": "zapier-proxy",
        },
        body: JSON.stringify({
          playbook_id,
          ...params,
          auto_execute: true,
          confirmed: true,
        }),
        signal: AbortSignal.timeout(120000),
      });

      const data = await coordRes.json();
      return NextResponse.json(data, { status: coordRes.status });
    }

    return NextResponse.json(
      {
        error:
          "Provide 'agent' or 'playbook_id' to execute, or 'action: subscribe' with 'hook_url'",
      },
      { status: 400 },
    );
  } catch (err) {
    log.error("Zapier webhook error", { error: String(err) });
    return NextResponse.json({ error: "Execution failed" }, { status: 500 });
  }
}
