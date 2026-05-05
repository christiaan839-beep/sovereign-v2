import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

/**
 * AGENT AUTH MIDDLEWARE — Validates Clerk sessions and enforces
 * plan-based rate limits on all agent API calls.
 *
 * Usage: Import and call at the top of every agent route.
 *
 * Plan limits:
 * - Free/Demo: 5 calls per day (for /demo page)
 * - Node (R9,997): 500 calls per day
 * - Array (R24,997): 2,000 calls per day
 * - Enterprise (R49,997): Unlimited
 */

export interface AuthResult {
  authorized: boolean;
  userId?: string;
  plan?: string;
  remaining?: number;
  error?: string;
}

// In-memory rate tracking with TTL cleanup
const USAGE_TRACKER = new Map<string, { count: number; reset: number }>();
let lastTrackerCleanup = Date.now();

import { getPlan, normalizePlanId } from "@/lib/plans";

// Daily rate limits for agent calls (derived from plan's demoRatePerDay / apiRatePerDay)
function getDailyLimit(planId: string): number {
  const plan = getPlan(planId);
  // Demo/free uses demoRatePerDay; paid plans use apiRatePerDay (capped for agent calls)
  return planId === "free"
    ? plan.demoRatePerDay
    : Math.min(plan.apiRatePerDay, 10_000);
}

// Purge expired entries every 10 minutes (prevents unbounded growth)
function cleanupTracker() {
  const now = Date.now();
  if (now - lastTrackerCleanup < 600_000) return; // 10 min
  lastTrackerCleanup = now;
  for (const [key, val] of USAGE_TRACKER) {
    if (val.reset < now) USAGE_TRACKER.delete(key);
  }
}

export async function authorizeAgent(
  request: Request,
  options?: { allowAnonymous?: boolean; agentName?: string },
): Promise<AuthResult> {
  cleanupTracker();

  // Check for demo/anonymous access
  if (options?.allowAnonymous) {
    const ip = request.headers.get("x-forwarded-for") || "anonymous";
    const key = `demo:${ip}`;
    const now = Date.now();
    const tracker = USAGE_TRACKER.get(key);

    if (tracker && tracker.reset > now) {
      if (tracker.count >= getDailyLimit("free")) {
        return {
          authorized: false,
          error: "Demo limit reached (5/day). Sign up for unlimited access.",
          remaining: 0,
        };
      }
      tracker.count += 1;
    } else {
      USAGE_TRACKER.set(key, { count: 1, reset: now + 86400000 }); // 24h reset
    }

    logUsage("anonymous", ip, options.agentName || "unknown");

    return {
      authorized: true,
      plan: "free",
      remaining: getDailyLimit("free") - (USAGE_TRACKER.get(key)?.count || 0),
    };
  }

  // Clerk auth check
  try {
    const { userId } = await auth();

    if (!userId) {
      return {
        authorized: false,
        error: "Authentication required. Please sign in.",
      };
    }

    // Read actual plan from the subscriptions table → tenants table fallback → free.
    // No more hardcoded "enterprise" — that allowed every authenticated user
    // to bypass paid plan limits.
    const plan = await resolveUserPlan(userId);
    const limit = getDailyLimit(plan);

    const key = `user:${userId}`;
    const now = Date.now();
    const tracker = USAGE_TRACKER.get(key);

    if (tracker && tracker.reset > now) {
      if (tracker.count >= limit) {
        return {
          authorized: false,
          userId,
          plan,
          remaining: 0,
          error: `Daily limit reached (${limit} calls). Upgrade your plan for more.`,
        };
      }
      tracker.count += 1;
    } else {
      USAGE_TRACKER.set(key, { count: 1, reset: now + 86400000 });
    }

    logUsage(userId, plan, options?.agentName || "unknown");

    return {
      authorized: true,
      userId,
      plan,
      remaining: limit - (USAGE_TRACKER.get(key)?.count || 0),
    };
  } catch (err) {
    // FAIL-CLOSED: a Clerk outage must NOT silently grant access.
    // The previous behavior returned { authorized: true } on any exception,
    // turning every transient JWKs hiccup into a complete auth bypass.
    return {
      authorized: false,
      error: "Authentication unavailable. Please try again shortly.",
    };
  }
}

/**
 * Resolve a user's plan ID from the subscriptions table.
 * Falls back to the tenants.plan column, then to "free".
 * Cached in-memory for 5 minutes per userId to avoid hitting the DB
 * on every authenticated request.
 */
const PLAN_CACHE = new Map<string, { plan: string; expires: number }>();
const PLAN_CACHE_TTL_MS = 5 * 60_000;

async function resolveUserPlan(userId: string): Promise<string> {
  const cached = PLAN_CACHE.get(userId);
  if (cached && cached.expires > Date.now()) return cached.plan;

  let plan = "free";
  try {
    const { db } = await import("@/db");
    const { subscriptions, tenants } = await import("@/db/schema");
    const { eq, and } = await import("drizzle-orm");

    // Check active subscription first (canonical source).
    // subscriptions.userId stores the Clerk user id (per src/db/schema.ts:334).
    try {
      const sub = await db
        .select({ plan: subscriptions.plan })
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.userId, userId),
            eq(subscriptions.status, "active"),
          ),
        )
        .limit(1);
      if (sub[0]?.plan) {
        plan = normalizePlanId(sub[0].plan);
      }
    } catch {
      // subscriptions table may not exist yet (migration 0003 pending) — fall through
    }

    // Fall back to tenants.plan column
    if (plan === "free") {
      try {
        const tenant = await db
          .select({ plan: tenants.plan })
          .from(tenants)
          .where(eq(tenants.clerkUserId, userId))
          .limit(1);
        if (tenant[0]?.plan) {
          plan = normalizePlanId(tenant[0].plan);
        }
      } catch {
        // tenants table issue — keep "free"
      }
    }
  } catch {
    // db import or any other failure → safest default is "free"
  }

  PLAN_CACHE.set(userId, { plan, expires: Date.now() + PLAN_CACHE_TTL_MS });
  return plan;
}

// ═══════════════════════════════════════════════
// USAGE LOGGING — Circular buffer (O(1) ops, fixed memory)
// ═══════════════════════════════════════════════

interface UsageLog {
  timestamp: string;
  userId: string;
  plan: string;
  agent: string;
  duration_ms?: number;
  status?: string;
}

const LOG_CAPACITY = 1000;
const USAGE_LOGS: UsageLog[] = new Array(LOG_CAPACITY);
let logHead = 0; // Write pointer
let logCount = 0; // Number of entries stored

function logUsage(userId: string, plan: string, agent: string) {
  USAGE_LOGS[logHead] = {
    timestamp: new Date().toISOString(),
    userId,
    plan,
    agent,
  };
  logHead = (logHead + 1) % LOG_CAPACITY;
  if (logCount < LOG_CAPACITY) logCount++;
}

export function logAgentExecution(
  userId: string,
  agent: string,
  duration_ms: number,
  status: string,
) {
  USAGE_LOGS[logHead] = {
    timestamp: new Date().toISOString(),
    userId,
    plan: "tracked",
    agent,
    duration_ms,
    status,
  };
  logHead = (logHead + 1) % LOG_CAPACITY;
  if (logCount < LOG_CAPACITY) logCount++;
}

function getLogsSnapshot(): UsageLog[] {
  if (logCount === 0) return [];
  if (logCount < LOG_CAPACITY) return USAGE_LOGS.slice(0, logCount);
  // Full buffer — read from oldest to newest
  return [...USAGE_LOGS.slice(logHead), ...USAGE_LOGS.slice(0, logHead)];
}

export function getUsageLogs(): UsageLog[] {
  return getLogsSnapshot();
}

export function getUsageStats() {
  const logs = getLogsSnapshot();
  const now = new Date();
  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).toISOString();
  const todayLogs = logs.filter((l) => l.timestamp >= today);

  const agentCounts: Record<string, number> = {};
  const userCounts: Record<string, number> = {};

  for (const log of todayLogs) {
    agentCounts[log.agent] = (agentCounts[log.agent] || 0) + 1;
    userCounts[log.userId] = (userCounts[log.userId] || 0) + 1;
  }

  return {
    total_calls_today: todayLogs.length,
    total_calls_all_time: logCount,
    calls_by_agent: agentCounts,
    unique_users_today: Object.keys(userCounts).length,
    top_agents: Object.entries(agentCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5),
  };
}

/**
 * Helper: Quick auth check that returns a NextResponse error if unauthorized.
 */
export async function quickAuth(
  request: Request,
  agentName: string,
  allowAnonymous = false,
): Promise<NextResponse | null> {
  const result = await authorizeAgent(request, { agentName, allowAnonymous });
  if (!result.authorized) {
    return NextResponse.json(
      { error: result.error, plan: result.plan, remaining: result.remaining },
      { status: 403 },
    );
  }
  return null;
}
