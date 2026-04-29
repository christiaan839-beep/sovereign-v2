/**
 * GET /api/cron/rollup-agent-credit
 *
 * Round 42 — daily cron that recomputes credit lines for every
 * agent that has a reputation score. Composes R40 reputation ×
 * R30 cost-runaway base limits into a published credit line.
 *
 * Auth: verifyCron (timing-safe, fail-closed).
 *
 * Why daily, not real-time:
 *   - Credit lines should be stable so customers can build
 *     procurement policies on them ("only A-grade allowed")
 *   - Real-time recompute would create whipsaw cap changes during
 *     an outage on the upstream reputation cron
 *   - Daily cadence creates a stable signal that's graphable
 *
 * NEVER 5xxs unless something catastrophic. The cron's job is to
 * be a steady producer of trust signal, not a critical path.
 *
 * Base daily limit policy:
 *   - For now: every agent uses the FREE tier base ($50/day = 5000
 *     cents). This is intentionally conservative — R43 will do the
 *     per-tenant lookup based on plan tier.
 *   - Stamping the snapshot here means historical credit-line rows
 *     are reproducible even if plan pricing changes.
 */

import { NextResponse } from "next/server";
import { verifyCron } from "@/lib/cron-auth";
import {
  computeCreditLine,
  multiplierForGrade,
} from "@/lib/agent-credit-line";
import type { LetterGrade } from "@/lib/agent-reputation";
import { createLogger } from "@/lib/logger";

const log = createLogger("cron:rollup-credit");

export const runtime = "nodejs";
export const maxDuration = 90;

interface RollupResult {
  agentsProcessed: number;
  agentsCredited: number;
  agentsNoScore: number;
  durationMs: number;
}

// R42 default base limit: matches the FREE-tier daily cap from
// R30 cost-runaway ($50). R43 will read this per-tenant from
// the actual plan tier.
const DEFAULT_BASE_DAILY_LIMIT_CENTS = 5000;

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
    const { agentReputationScores, agentCreditLines } = await import(
      "@/db/schema"
    );

    // Read every reputation score row (one per agent_id).
    const scores = await db.select().from(agentReputationScores);

    let agentsCredited = 0;
    let agentsNoScore = 0;

    for (const score of scores) {
      // Skip "no_score_yet" — we don't issue credit lines for
      // un-graded agents. They get the default base from R30.
      if (score.letterGrade === "no_score_yet") {
        agentsNoScore++;
        continue;
      }

      const grade = score.letterGrade as LetterGrade;
      const line = computeCreditLine({
        letterGrade: grade,
        numericScore: score.numericScore,
        baseDailyLimitCents: DEFAULT_BASE_DAILY_LIMIT_CENTS,
      });

      // Drizzle numeric: pass as string for precision safety.
      const multiplierStr = String(multiplierForGrade(grade));

      await db
        .insert(agentCreditLines)
        .values({
          agentId: score.agentId,
          letterGrade: grade,
          numericScore: score.numericScore,
          multiplier: multiplierStr,
          baseDailyLimitCents: line.baseDailyLimitCents,
          effectiveDailyLimitCents: line.effectiveDailyLimitCents,
        })
        .onConflictDoUpdate({
          target: agentCreditLines.agentId,
          set: {
            letterGrade: grade,
            numericScore: score.numericScore,
            multiplier: multiplierStr,
            baseDailyLimitCents: line.baseDailyLimitCents,
            effectiveDailyLimitCents: line.effectiveDailyLimitCents,
            computedAt: new Date(),
          },
        });

      agentsCredited++;
    }

    const result: RollupResult = {
      agentsProcessed: scores.length,
      agentsCredited,
      agentsNoScore,
      durationMs: Date.now() - start,
    };

    log.info("Credit rollup complete", { ...result });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    log.error("Credit rollup failed", { error: String(err) });
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
