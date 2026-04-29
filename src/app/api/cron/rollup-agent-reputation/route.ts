/**
 * GET /api/cron/rollup-agent-reputation
 *
 * Daily cron that recomputes reputation scores for every registered
 * agent. Aggregates signals from R26 audit + R30 reversals + R33 HITL
 * rejections + R38 manifest age, runs the pure-function calculator,
 * persists results in `agent_reputation_scores`.
 *
 * Auth: verifyCron (timing-safe, fail-closed).
 *
 * Why daily, not real-time:
 *   - Real-time scoring is gameable (mass-revoke a competitor)
 *   - Daily cadence creates stable signals graphable over time
 *   - Cron-based cycle is simpler to audit + reproduce
 *
 * NEVER 5xxs unless something catastrophic. The cron's job is to
 * be a steady producer of trust signal, not a critical path.
 */

import { NextResponse } from "next/server";
import { verifyCron } from "@/lib/cron-auth";
import { computeReputationScore } from "@/lib/agent-reputation";
import { gatherReputationSignals } from "@/lib/agent-reputation-signals";
import { createLogger } from "@/lib/logger";

const log = createLogger("cron:rollup-reputation");

export const runtime = "nodejs";
export const maxDuration = 90; // a couple thousand agents max

interface RollupResult {
  agentsProcessed: number;
  agentsScored: number;
  agentsNoData: number;
  durationMs: number;
}

export async function GET(req: Request) {
  const cronErr = verifyCron(req);
  if (cronErr) return cronErr;

  const start = Date.now();

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { ok: true, skipped: true, reason: "no DATABASE_URL" },
      { status: 200 },
    );
  }

  try {
    const { db } = await import("@/db");
    const {
      agentIdentityManifests,
      agentReputationScores,
    } = await import("@/db/schema");

    // Get every distinct agent_id from the manifest registry.
    const agents = await db
      .selectDistinctOn([agentIdentityManifests.agentId])
      .from(agentIdentityManifests)
      .orderBy(agentIdentityManifests.agentId, agentIdentityManifests.createdAt);

    let agentsScored = 0;
    let agentsNoData = 0;

    for (const agent of agents) {
      // For each agent, gather signals via the shared lib (R41).
      const signals = await gatherReputationSignals(
        db,
        agent.agentId,
        agent.createdAt,
      );
      const score = computeReputationScore(signals);

      if (score.letterGrade === "no_score_yet") {
        agentsNoData++;
      } else {
        agentsScored++;
      }

      // Upsert (replace) the score row.
      await db
        .insert(agentReputationScores)
        .values({
          agentId: agent.agentId,
          letterGrade: score.letterGrade,
          numericScore: score.numericScore,
          reversalRatePct: String(score.reversalRatePct),
          hitlRejectionPct: String(score.hitlRejectionPct),
          auditIntegrity: score.auditIntegrity,
          manifestAgeDays: score.manifestAgeDays,
          usageCount30d: score.usageCount30d,
          costEfficiencyScore: score.costEfficiencyScore,
          anomalyCount30d: score.anomalyCount30d,
          signalsJson: score.signalsBreakdown as unknown as Record<
            string,
            unknown
          >,
        })
        .onConflictDoUpdate({
          target: agentReputationScores.agentId,
          set: {
            letterGrade: score.letterGrade,
            numericScore: score.numericScore,
            reversalRatePct: String(score.reversalRatePct),
            hitlRejectionPct: String(score.hitlRejectionPct),
            auditIntegrity: score.auditIntegrity,
            manifestAgeDays: score.manifestAgeDays,
            usageCount30d: score.usageCount30d,
            costEfficiencyScore: score.costEfficiencyScore,
            anomalyCount30d: score.anomalyCount30d,
            signalsJson: score.signalsBreakdown as unknown as Record<
              string,
              unknown
            >,
            computedAt: new Date(),
          },
        });
    }

    const result: RollupResult = {
      agentsProcessed: agents.length,
      agentsScored,
      agentsNoData,
      durationMs: Date.now() - start,
    };

    log.info("Reputation rollup complete", { ...result });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    log.error("Rollup failed", { error: String(err) });
    return NextResponse.json(
      {
        ok: false,
        error: String(err),
        durationMs: Date.now() - start,
      },
      { status: 500 },
    );
  }
}

// gatherReputationSignals moved to src/lib/agent-reputation-signals.ts
// (R41) so the same logic is shared between the cron + the public
// signals endpoint + @sovereign/inspector for offline recompute.
