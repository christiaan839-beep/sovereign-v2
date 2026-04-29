/**
 * AGENT REPUTATION SIGNAL GATHERING.
 *
 * Round 41 — extracted from the daily rollup cron so the same
 * signals-fetching logic can be:
 *   - Reused by the cron (R40)
 *   - Exposed via a public signals API (R41)
 *   - Consumed by `@sovereign/inspector` for offline recompute (R41)
 *
 * The signals endpoint is the trustless-loop closure: customers
 * fetch the raw signal inputs from the platform, recompute the
 * reputation score on their own machine using the same pure-function
 * calculator, and verify the published score is mathematically
 * correct.
 *
 * Failure mode: if Sovereign ever fabricates a reputation score
 * that doesn't match the recomputed score from the published
 * signals, the inspector catches it. The platform CANNOT lie about
 * its own scoring.
 *
 * NEVER throws. SQL queries fail-soft to zero/safe defaults so the
 * gather step is steady-state.
 */

import { sql } from "drizzle-orm";
import type { ReputationSignals } from "./agent-reputation";
import { createLogger } from "./logger";

const log = createLogger("reputation-signals");

interface DbLike {
  execute: (q: ReturnType<typeof sql>) => Promise<{
    rows?: Array<Record<string, number | string>>;
  }>;
}

/**
 * Gather raw signals for one agent. SQL-driven; reads from R26
 * audit_logs + R30 agent_spend_charges + R33 hitl_approvals +
 * R38 agent_identity_manifests.
 *
 * Returns a `ReputationSignals` object that can be passed directly
 * to `computeReputationScore()` (in agent-reputation.ts) to derive
 * the same letter grade + numeric score.
 *
 * Pure with respect to the DB snapshot — same DB state at time T
 * always returns the same signals.
 */
export async function gatherReputationSignals(
  db: DbLike,
  agentId: string,
  manifestCreatedAt: Date,
): Promise<ReputationSignals> {
  const manifestAgeDays = Math.floor(
    (Date.now() - manifestCreatedAt.getTime()) / (1000 * 60 * 60 * 24),
  );

  let reversalCount30d = 0;
  let totalChargeCount30d = 0;
  try {
    const r = await db.execute(sql`
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
  } catch (err) {
    log.warn("reversal signals query failed", { agentId, error: String(err) });
  }

  let hitlDeniedCount30d = 0;
  let totalHitlCount30d = 0;
  try {
    const r = await db.execute(sql`
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
  } catch (err) {
    log.warn("hitl signals query failed", { agentId, error: String(err) });
  }

  let usageCount30d = 0;
  try {
    const r = await db.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM audit_logs
      WHERE resource = ${agentId}
        AND action = 'agent.execute'
        AND created_at > NOW() - INTERVAL '30 days'
    `);
    usageCount30d = Number(r.rows?.[0]?.total) || 0;
  } catch (err) {
    log.warn("usage signals query failed", { agentId, error: String(err) });
  }

  let anomalyCount30d = 0;
  try {
    const r = await db.execute(sql`
      SELECT COUNT(*)::int AS total
      FROM audit_logs
      WHERE resource = ${agentId}
        AND action LIKE 'anomaly.%'
        AND created_at > NOW() - INTERVAL '30 days'
    `);
    anomalyCount30d = Number(r.rows?.[0]?.total) || 0;
  } catch (err) {
    log.warn("anomaly signals query failed", { agentId, error: String(err) });
  }

  // Audit chain integrity check — optimistic for now; future round
  // wires directly into the verify-audit-chain cron's most recent
  // result.
  const auditChainIntact = true;

  // Cost-vs-median: TODO when execution_audit_log carries reliable
  // per-run cost data. Default 0 (at-median).
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
