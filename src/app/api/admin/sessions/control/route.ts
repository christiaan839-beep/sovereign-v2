/**
 * POST /api/admin/sessions/control
 *
 * Operator control over the persistent agent_sessions table.
 * Lets the admin abandon a stuck session, mark one failed, or
 * extend its TTL — and (without sessionId) trigger a sweep that
 * flips all stale active sessions to "abandoned".
 *
 * Body shapes:
 *   Per-session:
 *     { sessionId: "uuid", userId: "user_X", action: "abandon" | "fail" | "extend", reason?, addMinutes? }
 *   Sweep:
 *     { action: "cleanup", staleAfterMinutes?: number }
 *
 * Admin-gated (Clerk + email allowlist).
 */
import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import {
  normalizeAction,
  markSessionAbandoned,
  markSessionFailed,
  extendSessionTtl,
  cleanupStaleSessions,
} from "@/lib/admin-controls";

const log = createLogger("admin-sessions-control");

const ADMIN_EMAILS = new Set<string>([
  "christiaan839@gmail.com",
  "christiaandewet28@icloud.com",
]);

const limiter = rateLimit({ interval: 60, limit: 30 });

async function isCurrentUserAdmin(): Promise<boolean> {
  try {
    const { userId } = await auth();
    if (!userId) return false;
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email = user.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? "";
    return ADMIN_EMAILS.has(email);
  } catch (err) {
    log.warn("admin check failed", { error: String(err) });
    return false;
  }
}

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const admin = await isCurrentUserAdmin();
  if (!admin) {
    return NextResponse.json({ error: "admin-only" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const rawAction = typeof body.action === "string" ? body.action : null;

  // ─── Sweep path (no sessionId) ─────────────────────────────────
  if (rawAction === "cleanup") {
    const staleAfter =
      typeof body.staleAfterMinutes === "number" ? body.staleAfterMinutes : 30;
    const r = await cleanupStaleSessions(staleAfter);
    return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } });
  }

  // ─── Per-session path ──────────────────────────────────────────
  const action = normalizeAction(rawAction);
  if (!action) {
    return NextResponse.json(
      { error: "action must be 'abandon' | 'fail' | 'extend' | 'cleanup'" },
      { status: 400 },
    );
  }

  const sessionId =
    typeof body.sessionId === "string" && body.sessionId.trim().length > 0
      ? body.sessionId.trim()
      : null;
  const userId =
    typeof body.userId === "string" && body.userId.trim().length > 0
      ? body.userId.trim()
      : null;
  if (!sessionId || !userId) {
    return NextResponse.json(
      { error: "sessionId + userId required" },
      { status: 400 },
    );
  }
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) {
    return NextResponse.json(
      { error: "sessionId must be a UUID" },
      { status: 400 },
    );
  }

  let result;
  if (action === "abandon") {
    result = await markSessionAbandoned(sessionId, userId);
  } else if (action === "fail") {
    const reason =
      typeof body.reason === "string" ? body.reason : "operator-flagged";
    result = await markSessionFailed(sessionId, userId, reason);
  } else {
    // extend
    const addMinutes =
      typeof body.addMinutes === "number" ? body.addMinutes : 60;
    result = await extendSessionTtl(sessionId, userId, addMinutes);
  }

  if (!result.ok) {
    return NextResponse.json(result, {
      status: result.error === "agent_sessions missing" ? 503 : 400,
      headers: { "Cache-Control": "no-store" },
    });
  }
  return NextResponse.json(
    { action, sessionId, ...result },
    { headers: { "Cache-Control": "no-store" } },
  );
}
