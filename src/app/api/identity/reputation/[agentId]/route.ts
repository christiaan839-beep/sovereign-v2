/**
 * GET /api/identity/reputation/[agentId]
 *
 * PUBLIC, no-auth lookup of an agent's reputation score.
 *
 * Returns the most-recent computed reputation, including the full
 * signal breakdown so verifiers can see WHY the score is what it is.
 *
 * Cached for 1 hour — scores update once per day via the rollup cron.
 *
 * The reputation calculation is a PURE FUNCTION (`agent-reputation.ts`).
 * Any third party with access to the raw signals can recompute the
 * same score locally. Future R41 ports the calculator to
 * @sovereign/inspector for offline reputation recompute.
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { gradeFromScore } from "@/lib/agent-reputation";
import { createLogger } from "@/lib/logger";

const log = createLogger("identity-reputation");

export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;
  if (!agentId || agentId.length > 200) {
    return NextResponse.json({ error: "Invalid agent id" }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }

  try {
    const { db } = await import("@/db");
    const { agentReputationScores } = await import("@/db/schema");

    const rows = await db
      .select()
      .from(agentReputationScores)
      .where(eq(agentReputationScores.agentId, agentId))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json(
        {
          agentId,
          reputation: null,
          letterGrade: "no_score_yet",
          note: "No reputation score computed yet. Cron rolls up daily.",
        },
        { status: 200 },
      );
    }

    const r = rows[0];
    return NextResponse.json(
      {
        agentId,
        reputation: {
          letterGrade: r.letterGrade,
          numericScore: r.numericScore,
          reversalRatePct: Number(r.reversalRatePct),
          hitlRejectionPct: Number(r.hitlRejectionPct),
          auditIntegrity: r.auditIntegrity,
          manifestAgeDays: r.manifestAgeDays,
          usageCount30d: r.usageCount30d,
          costEfficiencyScore: r.costEfficiencyScore,
          anomalyCount30d: r.anomalyCount30d,
          signalsBreakdown: r.signalsJson,
          computedAt: r.computedAt.toISOString(),
        },
        verificationNote:
          "Reputation is computed via a pure function (agent-reputation.ts). " +
          "Verify locally by recomputing from on-chain signals.",
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "public, max-age=3600, s-maxage=3600, stale-while-revalidate=14400",
        },
      },
    );
  } catch (err) {
    log.error("reputation lookup failed", { agentId, error: String(err) });
    return NextResponse.json(
      { error: "Failed to load reputation" },
      { status: 500 },
    );
  }
}

// Reference helper to satisfy unused-import linter; gradeFromScore
// is the canonical mapping any port (Inspector etc.) should match.
const _unused = { gradeFromScore };
void _unused;
