/**
 * SOVEREIGN MATRIX — /api/_cron/soc2-indicators route (Cook 73)
 *
 * Scheduled emitter that derives the 9 SOC 2 indicators Cook 58
 * reads. Pulls live state from the existing observability surfaces:
 *
 *   - receipt-pass-rate          ← agent-runs success ratio (last 24 h)
 *   - receipt-non-drift-rate     ← drift-detector verdict ratio
 *   - red-team-critical-zero     ← 1 if no critical failures in last 7 d
 *   - encryption-at-rest-coverage ← static (Neon TLS + AES-256 = 1.0)
 *   - mfa-admin-fraction         ← Clerk admin MFA stats
 *   - failed-deploy-rate         ← Vercel deploy log (1 - failed/total)
 *   - incident-mttr-score        ← Sentry incident MTTR mapping
 *   - pii-scanner-coverage       ← layer-3 verifier coverage (=1 across registry)
 *   - dsr-response-sla           ← GDPR data-subject-request SLA (last 30 d)
 *
 * Security: CRON_SECRET header gate. Returns the collected
 * IndicatorReading[] plus the live Soc2Posture so callers can store
 * it for the /trust dashboard.
 */

import { NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { buildPosture } from "@/lib/soc2-monitor";
import { collectFromInputs, type CollectorInputs } from "@/lib/soc2-collector";
import { db } from "@/db";
import { agentActivity } from "@/db/schema";
import { and, gte, sql } from "drizzle-orm";

const log = createLogger("cron-soc2-indicators");

export const dynamic = "force-dynamic";

/**
 * Derive readings from observable platform state via the collector.
 *
 * Only inputs we can measure directly from our own database (agent-run
 * pass rate) are wired here. Indicators that depend on external systems we
 * don't query server-side (Sentry MTTR, Vercel deploys, Clerk admin MFA,
 * DSR SLA) are intentionally LEFT UNSET so the collector applies its
 * conservative "missing data" defaults rather than fabricated-perfect
 * numbers. This keeps the posture audit-honest: the snapshot reports what
 * we actually observe and nothing more.
 */
async function collectReadings() {
  const inputs: CollectorInputs = {};

  // Real agent-run pass rate over the last 24h, from agent_activity.
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        runs: sql<number>`count(*)::int`,
        passed: sql<number>`count(*) filter (where ${agentActivity.action} = 'completed')::int`,
      })
      .from(agentActivity)
      .where(and(gte(agentActivity.createdAt, since)));
    const runs = Number(rows[0]?.runs ?? 0);
    const passed = Number(rows[0]?.passed ?? 0);
    if (runs > 0) {
      inputs.agentRuns24h = runs;
      inputs.agentRunsPassed24h = passed;
    }
  } catch (err) {
    // Missing table / transient error → leave unset (conservative default).
    log.warn("agent_activity pass-rate query failed; using collector default", {
      error: String(err),
    });
  }

  return collectFromInputs(inputs);
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = req.headers.get("x-cron-secret");
  if (!secret || supplied !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const readings = await collectReadings();
  const posture = buildPosture(readings, { now });

  log.info("SOC 2 posture snapshot", {
    overallPassFraction: posture.overallPassFraction,
    generatedAt: posture.generatedAt,
  });

  return NextResponse.json({
    ok: true,
    // This is a self-monitored control snapshot derived from live platform
    // state — NOT a third-party SOC 2 attestation. Consumers must not present
    // it as certification.
    attested: false,
    posture,
  });
}
