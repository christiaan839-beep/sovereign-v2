/**
 * SOVEREIGN MATRIX — Metered Endpoint Wrapper
 *
 * Universal middleware for routes that bypass agent-factory but still
 * burn AI tokens (marketplace/submit, demo scans, custom skill runs, etc.).
 *
 * Bundles: auth → Upstash rate-limit → plan gate → handler → usage increment.
 * Returns a 429 with structured upgrade info when the user is over their limit.
 *
 * Usage:
 *   export const POST = withMetering("marketplace-submit", async (ctx) => {
 *     // ctx.userId, ctx.email, ctx.request available
 *     return NextResponse.json({ ok: true });
 *   });
 */

import { NextResponse } from "next/server";
import { guardRoute } from "@/lib/api-guard";
import {
  checkFreeUsage,
  incrementUsage,
  getSmartUpgradeInfo,
} from "@/lib/free-tier";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

const log = createLogger("metered-endpoint");

export interface MeteredContext {
  request: Request;
  userId: string;
  email: string;
}

export interface MeteringOptions {
  /** Skip Clerk auth — only do rate-limit + usage tracking by IP/key */
  public?: boolean;
  /** Per-minute request ceiling (default: 30) */
  rateLimitPerMin?: number;
  /** Skip usage increment (for read-only or admin endpoints) */
  skipUsageTracking?: boolean;
}

/**
 * Wrap a route handler with the universal metering pipeline.
 * Drop-in replacement for `export async function POST(req)`.
 */
export function withMetering(
  name: string,
  handler: (ctx: MeteredContext) => Promise<Response>,
  options: MeteringOptions = {},
) {
  const limiter = rateLimit({
    interval: 60,
    limit: options.rateLimitPerMin ?? 30,
  });

  return async function POST(req: Request): Promise<Response> {
    const startTime = Date.now();

    // ── Rate limit (Upstash-backed when configured, in-memory fallback) ──
    const limitResponse = await limiter.check(req);
    if (limitResponse) return limitResponse;

    // ── Auth ──
    let userId = "";
    let email = "";
    if (!options.public) {
      const guard = await guardRoute();
      if (!guard.authorized) return guard.response;
      userId = guard.userId;
      email = guard.email;
    }

    // ── Plan limit gate ──
    if (userId && !options.skipUsageTracking) {
      try {
        const usage = await checkFreeUsage(userId);
        if (!usage.allowed) {
          const upgrade = await getSmartUpgradeInfo(userId);
          log.warn("plan limit reached", {
            route: name,
            userId,
            plan: upgrade.currentPlan,
          });
          return NextResponse.json(
            {
              error: "Usage limit reached",
              message: `You've used all ${upgrade.currentLimit} runs this month on the ${upgrade.currentPlan} plan.`,
              upgrade,
              code: "USAGE_LIMIT_REACHED",
            },
            { status: 429, headers: { "X-Free-Remaining": "0" } },
          );
        }
      } catch (err) {
        log.warn("plan check failed — allowing", {
          route: name,
          error: String(err),
        });
      }
    }

    // ── Execute handler ──
    let response: Response;
    try {
      response = await handler({ request: req, userId, email });
    } catch (err) {
      log.error("handler failed", { route: name, error: String(err) });
      return NextResponse.json(
        { error: "Internal error", code: "HANDLER_ERROR" },
        { status: 500 },
      );
    }

    // ── Increment usage on successful 2xx ──
    // Awaited so the row lands BEFORE we return — on Vercel a fire-and-forget
    // .catch() can be killed when the function completes, letting users blast
    // past their quota by parallelizing requests faster than the DB writes.
    if (userId && !options.skipUsageTracking && response.ok) {
      try {
        await incrementUsage(userId, name);
      } catch (err) {
        log.warn("usage increment failed", {
          route: name,
          userId,
          error: String(err),
        });
      }
    }

    log.info("request complete", {
      route: name,
      userId: userId || "anon",
      status: response.status,
      durationMs: Date.now() - startTime,
    });

    return response;
  };
}
