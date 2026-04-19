import { NextResponse } from "next/server";
import { db } from "@/db";
import { usage } from "@/db/schema";
import { createLogger } from "@/lib/logger";

const log = createLogger("free-tool-proxy");

/**
 * FREE TOOL PROXY — Public endpoint for /free/* pages.
 *
 * Rate-limit identity per ADR-0001 (Option C, email-or-IP soft capture):
 *   - Email supplied  → 10 runs / hour keyed on email
 *   - Email omitted   → 3  runs / hour keyed on IP
 *   - IP ceiling      → 20 runs / hour regardless of email
 *                       (prevents one IP spraying fake emails)
 *
 * Also records every run to the `usage` table with source="free-tool" so we
 * can analyze the funnel later.
 *
 * See: docs/adr/0001-free-tool-rate-limit-identity.md
 */

/* ─── Quotas ───────────────────────────────────────────────────── */

const EMAIL_LIMIT = 10;          // runs / hr when email supplied
const IP_LIMIT = 3;              // runs / hr when only IP
const IP_CEILING = 20;           // absolute per-IP ceiling per hr
const WINDOW_MS = 60 * 60 * 1000;

type Window = { count: number; resetAt: number };

const emailWindows = new Map<string, Window>();
const ipWindows = new Map<string, Window>();

/** Advance a rate-limit window. Returns { allowed, remaining }. */
function tick(map: Map<string, Window>, key: string, limit: number, now: number): { allowed: boolean; remaining: number } {
  const w = map.get(key);
  if (!w || w.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: limit - 1 };
  }
  if (w.count >= limit) {
    return { allowed: false, remaining: 0 };
  }
  w.count += 1;
  return { allowed: true, remaining: limit - w.count };
}

/** Occasional cleanup — cheap. */
function sweep(map: Map<string, Window>, now: number) {
  if (map.size < 5000) return;
  for (const [k, v] of map) if (v.resetAt <= now) map.delete(k);
}

/* ─── Validation ───────────────────────────────────────────────── */

const ALLOWED_AGENTS = new Set([
  "seo-dominator", "seo", "leads", "brand-voice",
  "competitor-scan", "competitor", "brand-audit",
]);

/** Reject obvious bad email shapes without requiring a full RFC parser. */
function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length < 5 || trimmed.length > 254) return null;
  // Shape: something@something.tld — blocks empty, "@", "a@b"
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) return null;
  return trimmed;
}

/* ─── Handler ──────────────────────────────────────────────────── */

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const now = Date.now();

    const body = await req.json().catch(() => ({}));
    const { agent, params, email: rawEmail } = body as {
      agent?: string;
      params?: Record<string, unknown>;
      email?: string;
    };
    const email = normalizeEmail(rawEmail);

    // IP ceiling — always applied, regardless of email presence.
    const ipCeil = tick(ipWindows, `ceil:${ip}`, IP_CEILING, now);
    if (!ipCeil.allowed) {
      return NextResponse.json(
        {
          error: "Too many requests from this network. Please try again in an hour.",
          remaining: 0,
        },
        { status: 429, headers: { "X-Free-Remaining": "0" } },
      );
    }

    // Primary rate-limit — email if supplied, else IP.
    const primaryKey = email ? `email:${email}` : `ip:${ip}`;
    const primaryLimit = email ? EMAIL_LIMIT : IP_LIMIT;
    const primaryMap = email ? emailWindows : ipWindows;
    const primary = tick(primaryMap, primaryKey, primaryLimit, now);

    if (!primary.allowed) {
      const message = email
        ? `Free tool limit reached (${EMAIL_LIMIT}/hour). Sign up for unlimited access.`
        : `Free tool limit reached (${IP_LIMIT}/hour). Enter an email above for ${EMAIL_LIMIT}/hour, or sign up for unlimited access.`;
      return NextResponse.json(
        { error: message, remaining: 0, limit: primaryLimit, upgradeUrl: "/signup" },
        { status: 429, headers: { "X-Free-Remaining": "0" } },
      );
    }

    sweep(emailWindows, now);
    sweep(ipWindows, now);

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
      headers: {
        "Content-Type": "application/json",
        "X-Sovereign-Internal": "free-tool-proxy",
      },
      body: JSON.stringify({ ...(params ?? {}), confirmed: true }),
      signal: AbortSignal.timeout(30_000),
    });

    const data = await agentRes.json();

    // Record to `usage` table (fire-and-forget). Missing table is OK in
    // bootstrap environments — log and continue so the user still gets output.
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
          limit: primaryLimit,
          keyed_on: email ? "email" : "ip",
          upgradeUrl: "/signup",
        },
      },
      {
        status: agentRes.status,
        headers: {
          "X-Free-Remaining": String(Math.max(0, primary.remaining)),
          "X-Free-Keyed-On": email ? "email" : "ip",
        },
      },
    );
  } catch (err) {
    log.error("Free tool proxy error", { error: String(err) });
    return NextResponse.json({ error: "Agent temporarily unavailable" }, { status: 502 });
  }
}
