/**
 * POST /api/admin/cohort-proof
 *
 * Builds + returns a verifiable cohort proof for the requested
 * window. Pulls receipt IDs from agent_runs, computes the
 * commitment, returns both the public commitment AND the operator
 * secret. The secret must be stored in operator-only storage —
 * losing it means you can't prove the commitment later.
 *
 * Body shape:
 *   { windowStart: "YYYY-MM-DD", windowEnd: "YYYY-MM-DD" }
 *
 * Body limits:
 *   - Window can't exceed 31 days (memory bound)
 */
import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { agentRuns } from "@/db/schema";
import { and, gt, lt, eq } from "drizzle-orm";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { buildCohortProof, renderClaim } from "@/lib/cohort-proofs";

const log = createLogger("admin-cohort-proof");

const ADMIN_EMAILS = new Set<string>([
  "christiaan839@gmail.com",
  "christiaandewet28@icloud.com",
]);

const limiter = rateLimit({ interval: 60, limit: 12 });

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

function parseUtcDate(raw: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) return null;
  return new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0),
  );
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

  const startStr = typeof body.windowStart === "string" ? body.windowStart : "";
  const endStr = typeof body.windowEnd === "string" ? body.windowEnd : "";
  const start = parseUtcDate(startStr);
  const end = parseUtcDate(endStr);
  if (!start || !end) {
    return NextResponse.json(
      { error: "windowStart + windowEnd required as YYYY-MM-DD UTC" },
      { status: 400 },
    );
  }
  if (end < start) {
    return NextResponse.json(
      { error: "windowEnd must be >= windowStart" },
      { status: 400 },
    );
  }
  const days = Math.floor(
    (end.getTime() + 24 * 60 * 60 * 1000 - start.getTime()) /
      (24 * 60 * 60 * 1000),
  );
  if (days > 31) {
    return NextResponse.json(
      { error: "window must be ≤ 31 days" },
      { status: 400 },
    );
  }

  const exclusiveEnd = new Date(end.getTime() + 24 * 60 * 60 * 1000);

  try {
    const ids = await db
      .select({ id: agentRuns.id })
      .from(agentRuns)
      .where(
        and(
          gt(agentRuns.createdAt, start),
          lt(agentRuns.createdAt, exclusiveEnd),
        ),
      );
    const approved = await db
      .select({ id: agentRuns.id })
      .from(agentRuns)
      .where(
        and(
          gt(agentRuns.createdAt, start),
          lt(agentRuns.createdAt, exclusiveEnd),
          eq(agentRuns.trustDecision, "auto-approved"),
        ),
      );

    const proof = buildCohortProof({
      windowStart: startStr,
      windowEnd: endStr,
      receiptIds: ids.map((r) => r.id),
      approvedCount: approved.length,
    });

    return NextResponse.json(
      {
        ...proof,
        publicClaim: renderClaim(proof.commitment),
        operatorNote:
          "Store `secret` in operator-only storage. Without it, you cannot prove the commitment to an auditor later.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "42P01") {
      return NextResponse.json(
        { error: "agent_runs table not yet migrated" },
        { status: 503 },
      );
    }
    log.warn("cohort proof failed", { error: String(err) });
    return NextResponse.json({ error: "internal-error" }, { status: 500 });
  }
}
