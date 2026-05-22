/**
 * GET /api/admin/sessions[?agentName=foo&status=active&limit=50]
 *
 * Admin-only — returns recent agent_sessions rows from the persistent
 * session store (Wave 126). This is the cross-user, operator-facing
 * view: which users have active resumable agent runs, which agents
 * are accumulating step history, which sessions are stuck.
 *
 * Auth: Clerk session + email allowlist via isAdmin(). Anyone else
 * gets 403. The agent_sessions table includes opaque state blobs
 * that may contain PII — this endpoint is operator-only by design.
 *
 * Filters:
 *   - agentName: optional, exact match
 *   - status: optional, one of active|done|failed|abandoned
 *   - limit: 1-200, default 50
 *
 * Caching: 30-second edge cache. Sessions tick on every step, so
 * the polling cadence on the page matches the cache TTL.
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { agentSessions } from "@/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-sessions");

const ADMIN_EMAILS = new Set<string>([
  "christiaan839@gmail.com",
  "christiaandewet28@icloud.com",
]);

const VALID_STATUSES = new Set(["active", "done", "failed", "abandoned"]);

const limiter = rateLimit({ interval: 60, limit: 60 });

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

function clampLimit(raw: string | null): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n)) return 50;
  return Math.min(Math.max(n, 1), 200);
}

interface SessionSummary {
  id: string;
  userId: string;
  agentName: string;
  status: string;
  stepCount: number;
  createdAt: string;
  lastTouchedAt: string;
  expiresAt: string | null;
  /** Last step label (if any) for quick scanning. */
  lastStepLabel: string | null;
  /** Truncated state preview — first 200 chars of the JSON blob. */
  statePreview: string;
}

function parseLastStepLabel(stepsBlob: string): string | null {
  try {
    const arr = JSON.parse(stepsBlob);
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const last = arr[arr.length - 1];
    if (last && typeof last === "object" && typeof last.label === "string") {
      return last.label.slice(0, 80);
    }
    return null;
  } catch {
    return null;
  }
}

function isMissingTableError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  const msg = err instanceof Error ? err.message : String(err);
  return code === "42P01" || /does not exist/.test(msg);
}

export async function GET(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const admin = await isCurrentUserAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "admin-only" },
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  const url = new URL(req.url);
  const agentName = url.searchParams.get("agentName")?.trim() || null;
  const statusFilter = url.searchParams.get("status")?.trim() || null;
  const limit = clampLimit(url.searchParams.get("limit"));

  try {
    const conds = [] as ReturnType<typeof eq>[];
    if (agentName) conds.push(eq(agentSessions.agentName, agentName));
    if (statusFilter && VALID_STATUSES.has(statusFilter)) {
      conds.push(eq(agentSessions.status, statusFilter));
    }
    const where = conds.length > 0 ? and(...conds) : undefined;

    const rows = await db
      .select({
        id: agentSessions.id,
        userId: agentSessions.userId,
        agentName: agentSessions.agentName,
        status: agentSessions.status,
        state: agentSessions.state,
        steps: agentSessions.steps,
        stepCount: agentSessions.stepCount,
        createdAt: agentSessions.createdAt,
        lastTouchedAt: agentSessions.lastTouchedAt,
        expiresAt: agentSessions.expiresAt,
      })
      .from(agentSessions)
      .where(where ?? undefined)
      .orderBy(desc(agentSessions.lastTouchedAt))
      .limit(limit);

    const sessions: SessionSummary[] = rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      agentName: r.agentName,
      status: r.status ?? "active",
      stepCount: r.stepCount ?? 0,
      createdAt: (r.createdAt as Date).toISOString(),
      lastTouchedAt: (r.lastTouchedAt as Date).toISOString(),
      expiresAt: r.expiresAt ? (r.expiresAt as Date).toISOString() : null,
      lastStepLabel: parseLastStepLabel(r.steps ?? "[]"),
      statePreview: (r.state ?? "{}").slice(0, 200),
    }));

    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        count: sessions.length,
        limit,
        filters: { agentName, status: statusFilter },
        sessions,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=30, s-maxage=30",
        },
      },
    );
  } catch (err) {
    if (isMissingTableError(err)) {
      return NextResponse.json(
        {
          generatedAt: new Date().toISOString(),
          count: 0,
          limit,
          filters: { agentName, status: statusFilter },
          sessions: [],
          warning: "agent_sessions table not yet migrated — run drizzle/0026",
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    log.warn("admin sessions query failed", { error: String(err) });
    return NextResponse.json(
      { error: "query-failed" },
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
