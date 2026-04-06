import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("free-tool-proxy");

/**
 * FREE TOOL PROXY — Public endpoint for /free/* pages.
 * Rate limited by IP (3 runs per hour per IP).
 * Routes to internal agents without requiring Clerk auth.
 */

const ipLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 3; // 3 runs per hour
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Allowed agents for free tools (only non-destructive read-only agents)
const ALLOWED_AGENTS = new Set(["seo-dominator", "leads", "brand-voice", "competitor-scan"]);

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    // Rate limit
    const now = Date.now();
    const limit = ipLimits.get(ip);
    if (limit && limit.resetAt > now) {
      if (limit.count >= RATE_LIMIT) {
        return NextResponse.json(
          { error: "Free tool limit reached (3/hour). Sign up for unlimited access.", remaining: 0 },
          { status: 429 }
        );
      }
      limit.count++;
    } else {
      ipLimits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    }

    // Cleanup stale entries
    if (ipLimits.size > 5000) {
      for (const [key, val] of ipLimits) {
        if (val.resetAt < now) ipLimits.delete(key);
      }
    }

    const { agent, params } = await req.json();

    if (!agent || !ALLOWED_AGENTS.has(agent)) {
      return NextResponse.json(
        { error: `Agent not available in free tier. Allowed: ${[...ALLOWED_AGENTS].join(", ")}` },
        { status: 400 }
      );
    }

    // Forward to internal agent route
    const baseUrl = req.headers.get("x-forwarded-proto") === "https"
      ? `https://${req.headers.get("host")}`
      : `http://${req.headers.get("host") || "localhost:3000"}`;

    const agentRes = await fetch(`${baseUrl}/api/agents/${agent}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sovereign-Internal": "free-tool-proxy",
      },
      body: JSON.stringify({ ...params, confirmed: true }),
      signal: AbortSignal.timeout(30000),
    });

    const data = await agentRes.json();
    const remaining = RATE_LIMIT - (ipLimits.get(ip)?.count || 0);

    return NextResponse.json(
      { ...data, _free: { remaining, limit: RATE_LIMIT } },
      {
        status: agentRes.status,
        headers: { "X-Free-Remaining": String(Math.max(0, remaining)) },
      }
    );
  } catch (err) {
    log.error("Free tool proxy error", { error: String(err) });
    return NextResponse.json({ error: "Agent temporarily unavailable" }, { status: 502 });
  }
}
