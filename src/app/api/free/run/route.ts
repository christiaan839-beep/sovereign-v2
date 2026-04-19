import { NextResponse } from "next/server";
import { db } from "@/db";
import { usage } from "@/db/schema";
import { createLogger } from "@/lib/logger";
import {
  checkEmailLimit,
  checkIpLimit,
  checkIpCeiling,
  EMAIL_LIMIT,
  IP_LIMIT,
} from "@/lib/free-tool-limits";

const log = createLogger("free-tool-proxy");

/**
 * FREE TOOL PROXY — Public endpoint for /free/* pages.
 *
 * Rate-limit identity per ADR-0001 (Option C, email-or-IP soft capture):
 *   - Email supplied  → 10 runs/hr keyed on normalized email
 *   - Email omitted   → 3  runs/hr keyed on IP
 *   - IP ceiling      → 20 runs/hr regardless of email
 *                       (prevents fake-email spray from one IP)
 *
 * Counts are stored in Upstash Redis when configured, otherwise in-memory
 * per edge instance (see src/lib/free-tool-limits.ts).
 *
 * Every run writes a row to `usage` with source encoded in userId so the
 * funnel is analyzable (free:email or free:ip:<addr>).
 */

const ALLOWED_AGENTS = new Set([
  "seo-dominator", "seo", "leads", "brand-voice",
  "competitor-scan", "competitor", "brand-audit",
]);

/** Reject obvious bad email shapes without requiring a full RFC parser. */
function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length < 5 || trimmed.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) return null;
  return trimmed;
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    const body = await req.json().catch(() => ({}));
    const { agent, params, email: rawEmail } = body as {
      agent?: string;
      params?: Record<string, unknown>;
      email?: string;
    };
    const email = normalizeEmail(rawEmail);

    // IP ceiling — applied regardless of whether an email was supplied.
    const ceil = await checkIpCeiling(ip);
    if (!ceil.allowed) {
      return NextResponse.json(
        { error: "Too many requests from this network. Please try again in an hour.", remaining: 0 },
        { status: 429, headers: { "X-Free-Remaining": "0", "X-Free-Backend": ceil.backend } },
      );
    }

    // Primary bucket — email if supplied, else IP.
    const primary = email ? await checkEmailLimit(email) : await checkIpLimit(ip);
    if (!primary.allowed) {
      const message = email
        ? `Free tool limit reached (${EMAIL_LIMIT}/hour). Sign up for unlimited access.`
        : `Free tool limit reached (${IP_LIMIT}/hour). Enter an email above for ${EMAIL_LIMIT}/hour, or sign up for unlimited access.`;
      return NextResponse.json(
        { error: message, remaining: 0, limit: primary.limit, upgradeUrl: "/signup" },
        {
          status: 429,
          headers: {
            "X-Free-Remaining": "0",
            "X-Free-Backend": primary.backend,
          },
        },
      );
    }

    if (!agent || !ALLOWED_AGENTS.has(agent)) {
      return NextResponse.json(
        { error: `Agent not available in free tier. Allowed: ${[...ALLOWED_AGENTS].join(", ")}` },
        { status: 400 },
      );
    }

    // Forward to the real agent.
    const baseUrl = req.headers.get("x-forwarded-proto") === "https"
      ? `https://${req.headers.get("host")}`
      : `http://${req.headers.get("host") || "localhost:3000"}`;

    const agentRes = await fetch(`${baseUrl}/api/agents/${encodeURIComponent(agent)}`, {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: {
        "Content-Type": "application/json",
        "X-Sovereign-Internal": "free-tool-proxy",
      },
      body: JSON.stringify({ ...(params ?? {}), confirmed: true }),
    });

    const data = await agentRes.json();

    // Fire-and-forget usage write. Missing-table (42P01) is OK in bootstrap.
    const usageUserId = email ? `free:${email}` : `free:ip:${ip}`;
    db.insert(usage)
      .values({ userId: usageUserId, agentId: agent, model: "auto", tokensUsed: 0 })
      .catch((err: Error) => {
        const code = (err as unknown as { code?: string }).code;
        if (code !== "42P01") {
          log.warn("free-tool usage insert failed", { error: err.message });
        }
      });

    return NextResponse.json(
      {
        ...data,
        _free: {
          remaining: primary.remaining,
          limit: primary.limit,
          keyed_on: email ? "email" : "ip",
          upgradeUrl: "/signup",
        },
      },
      {
        status: agentRes.status,
        headers: {
          "X-Free-Remaining": String(Math.max(0, primary.remaining)),
          "X-Free-Keyed-On": email ? "email" : "ip",
          "X-Free-Backend": primary.backend,
        },
      },
    );
  } catch (err) {
    const isTimeout = err instanceof DOMException && err.name === "TimeoutError";
    if (isTimeout) {
      log.warn("Free tool proxy — internal agent timeout");
      return NextResponse.json({ error: "Agent timed out. Please try again." }, { status: 504 });
    }
    log.error("Free tool proxy error", { error: String(err) });
    return NextResponse.json({ error: "Agent temporarily unavailable" }, { status: 502 });
  }
}
