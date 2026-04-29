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
import { sql } from "drizzle-orm";
import { verifyCron } from "@/lib/cron-auth";
import { computeReputationScore } from "@/lib/agent-reputation";
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
      // For each agent, gather signals. SQL queries are scoped per agent.
      const signals = await gatherSignals(db, agent.agentId, agent.createdAt);
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

/**
 * Gather raw signals for one agent. SQL-driven; reads from R26
 * audit_logs + R30 agent_spend_charges + R33 hitl_approvals.
 *
 * NEVER throws — failures yield zero/safe defaults so the rollup
 * keeps making progress on other agents.
 */
async function gatherSignals(
  db: unknown,
  agentId: string,
  manifestCreatedAt: Date,
): Promise<{
  reversalCount30d: number;
  totalChargeCount30d: number;
  hitlDeniedCount30d: number;
  totalHitlCount30d: number;
  auditChainIntact: boolean;
  manifestAgeDays: number;
  usageCount30d: number;
  costVsMedianPct: number;
  anomalyCount30d: number;
}> {
  const dbAny = db as {
    execute: (q: ReturnType<typeof sql>) => Promise<{
      rows?: Array<Record<string, number | string>>;
    }>;
  };
  const manifestAgeDays = Math.floor(
    (Date.now() - manifestCreatedAt.getTime()) / (1000 * 60 * 60 * 24),
  );

  // Aggregate via raw SQL — fast + simple.
  let reversalCount30d = 0;
  let totalChargeCount30d = 0;
  try {
    const r = await dbAny.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'reversed')::int AS reversed,
        COUNT(*)::int AS total
      FROM agent_spend_charges
      WHERE agent_name = ${agentId}
        AND created_at > NOW() - INTERVAL '30 days'
    `);
    const row = r.rows?.[0];
    if (row) {
      reversalCount30d = Number(row.reversed) || 0;
      totalChargeCount30d = Number(row.total) || 0;
    }
  } catch {
    /* signals fail-soft — keep zeros */
  }

  let hitlDeniedCount30d = 0;
  let totalHitlCount30d = 0;
  try {
    const r = await dbAny.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'denied')::int AS denied,
        COUNT(*)::int AS total
      FROM hitl_approvals
      WHERE agent_name = ${agentId}
        AND created_at > NOW() - INTERVAL '30 days'
    `);
    const row = r.rows?.[0];
    if (row) {
      hitlDeniedCount30d = Number(row.denied) || 0;
      totalHitlCount30d = Number(row.total) || 0;
    }
  } catch { /* fail-soft */ }

  let usageCount30d = 0;
  try {
    const r = await dbAny.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM audit_logs
      WHERE resource = ${agentId}
        AND action = 'agent.execute'
        AND created_at > NOW() - INTERVAL '30 days'
    `);
    usageCount30d = Number(r.rows?.[0]?.total) || 0;
  } catch { /* fail-soft */ }

  let anomalyCount30d = 0;
  try {
    const r = await dbAny.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM audit_logs
      WHERE resource = ${agentId}
        AND action LIKE 'anomaly.%'
        AND created_at > NOW() - INTERVAL '30 days'
    `);
    anomalyCount30d = Number(r.rows?.[0]?.total) || 0;
  } catch { /* fail-soft */ }

  // Audit chain integrity: assume true (fast path). A separate cron
  // (verify-audit-chain) sets this to false in audit_logs if there's
  // a break. For now we use the optimistic default; future round can
  // hook into the chain-verifier output more directly.
  const auditChainIntact = true;

  // Cost vs median: TODO when execution_audit_log carries reliable
  // cost data per run. Default to 0 (at-median) for now.
  const costVsMedianPct = 0;

  return {
    reversalCount30d,
    totalChargeCount30d,
    hitlDeniedCount30d,
    totalHitlCount30d,
    auditChainIntact,
    manifestAgeDays,
    usageCount30d,
    costVsMedianPct,
    anomalyCount30d,
  };
}
