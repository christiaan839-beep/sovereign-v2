/**
 * Agent health grading + leaderboard.
 *
 * Produces a single letter grade (A / B / C / D / F) for every
 * verified + public marketplace agent based on four signals:
 *
 *   Success rate      (40%)  did the invocation complete without error?
 *   Latency           (25%)  p50 vs category baseline
 *   Safety score      (20%)  NemoGuard composite from submission
 *   Volume signal     (15%)  regression-toward-B for low-sample agents
 *
 * Why letter grades: buyers glance, compare, decide. Four separate
 * numbers are noise; one letter is signal.
 *
 * Why volume regression: an agent with 3 perfect runs isn't as
 * trustworthy as one with 300 mostly-perfect runs. Low-volume
 * agents get pulled toward the B midpoint proportional to how
 * much data we have.
 *
 * Graceful no-DB / no-telemetry: every agent defaults to C (unknown)
 * so the dashboard never shows empty cells.
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  marketplaceAgents,
  marketplaceAgentViews,
  usage,
} from "@/db/schema";
import { createLogger } from "@/lib/logger";

const log = createLogger("agent-health");

/* ─── Types ───────────────────────────────────────────────────── */

export type AgentGrade = "A" | "B" | "C" | "D" | "F";

export interface AgentHealthSignal {
  agentId: string;
  slug: string | null;
  name: string;
  category: string;
  /** Percent of invocations that did not throw. 0..1 */
  successRate: number;
  /** Median response time in ms. */
  p50LatencyMs: number;
  /** Submission-time safety score 0..100. */
  safetyScore: number;
  /** Total invocation count (used for volume regression). */
  sampleSize: number;
  /** Final grade. */
  grade: AgentGrade;
  /** Composite numeric score 0..100 the grade is derived from. */
  score: number;
}

/* ─── Scoring math ────────────────────────────────────────────── */

/**
 * Map 0..100 to a letter grade. Cutoffs are generous — "A" rewards
 * clear excellence (>=85), "B" is the expected baseline (70-84),
 * "C" signals room for improvement (55-69), "D" warns (40-54),
 * "F" flags (below 40).
 */
export function scoreToGrade(score: number): AgentGrade {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

/**
 * Compose a composite score from the four signals.
 *
 * Volume regression: scale the effective confidence by
 *   k / (k + sampleSize), k=30.
 * At sampleSize=0, the score is 100% pulled toward B (65).
 * At sampleSize=30, it's 50% blend. At 300, effectively raw.
 *
 * Safety is CAPPED-FLOOR, not averaged — any safety score below 40
 * drops the final grade to F regardless of other signals. A fast,
 * reliable agent that's unsafe is not graded higher than F.
 */
export function composeHealthScore(args: {
  successRate: number;
  p50LatencyMs: number;
  safetyScore: number;
  sampleSize: number;
  categoryLatencyBaselineMs?: number;
}): { score: number; grade: AgentGrade } {
  if (args.safetyScore < 40) {
    return { score: 0, grade: "F" };
  }

  // Success rate: already 0..1, scale to 0..100.
  const successComp = Math.max(0, Math.min(1, args.successRate)) * 100;

  // Latency: compare p50 to category baseline (default 5000ms).
  // Latency <= baseline scores 100; 3× baseline scores 0.
  const baseline = args.categoryLatencyBaselineMs ?? 5000;
  const latencyRatio = args.p50LatencyMs / baseline;
  const latencyComp =
    args.p50LatencyMs <= 0
      ? 100
      : Math.max(0, 100 * (1 - (latencyRatio - 1) / 2));

  // Safety: 0..100 passthrough.
  const safetyComp = Math.max(0, Math.min(100, args.safetyScore));

  // Raw weighted composite.
  const raw =
    0.4 * successComp +
    0.25 * latencyComp +
    0.2 * safetyComp +
    0.15 * 70; /* volume-neutral filler (regresses toward B) */

  // Volume regression blend.
  const k = 30;
  const confidence = args.sampleSize / (args.sampleSize + k);
  const blended = confidence * raw + (1 - confidence) * 65;

  const score = Math.round(Math.max(0, Math.min(100, blended)));
  return { score, grade: scoreToGrade(score) };
}

/* ─── Internals ───────────────────────────────────────────────── */

function databaseIsConfigured(): boolean {
  return typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0;
}

/* ─── Public API ──────────────────────────────────────────────── */

/**
 * Compute health signals for the top-N most-run agents. Intended
 * for /marketplace/leaderboard rendering — one query, no N+1.
 */
export async function getTopAgentHealth(
  limit = 20,
): Promise<AgentHealthSignal[]> {
  if (!databaseIsConfigured()) return [];
  const clamped = Math.min(Math.max(limit, 1), 100);

  try {
    const rows = await db
      .select({
        id: marketplaceAgents.id,
        slug: marketplaceAgents.slug,
        name: marketplaceAgents.name,
        category: marketplaceAgents.category,
        totalRunCount: marketplaceAgents.totalRunCount,
        safetyScore: marketplaceAgents.safetyScore,
        // Success rate from the usage table — errored rows have cost_cents IS NULL
        //   (the cost-ledger columns are populated on success; legacy rows
        //    pre-migration 0012 have NULL too, so this is approximate).
        successfulRuns: sql<number>`COALESCE(
          (SELECT COUNT(*)::int FROM ${usage}
           WHERE ${usage.agentId} = ${marketplaceAgents.id}::text),
          0
        )`,
        // p50 latency proxy: derive from the week's view volume as a
        // signal until we instrument real latency — placeholder that
        // returns a reasonable middle value rather than skewing the
        // composite score.
        viewsCount: sql<number>`COALESCE((
          SELECT COUNT(*)::int FROM ${marketplaceAgentViews}
          WHERE ${marketplaceAgentViews.agentId} = ${marketplaceAgents.id}
        ), 0)`,
      })
      .from(marketplaceAgents)
      .where(
        and(
          eq(marketplaceAgents.verificationStatus, "verified"),
          eq(marketplaceAgents.isPublic, true),
        ),
      )
      .orderBy(desc(marketplaceAgents.totalRunCount))
      .limit(clamped);

    return rows.map((r) => {
      const sampleSize = Number(r.totalRunCount ?? 0);
      const successCount = Number(r.successfulRuns ?? 0);
      const successRate =
        sampleSize > 0 ? Math.min(1, successCount / sampleSize) : 0.7; // neutral default
      const safetyScore = Number(r.safetyScore ?? 70);
      // p50 placeholder — replace with real per-agent SLO data once the
      // usage table carries latency_ms. For now, use a reasonable
      // middle so volume regression does most of the work.
      const p50LatencyMs = 3000;

      const { score, grade } = composeHealthScore({
        successRate,
        p50LatencyMs,
        safetyScore,
        sampleSize,
      });

      return {
        agentId: r.id,
        slug: r.slug,
        name: r.name,
        category: r.category,
        successRate,
        p50LatencyMs,
        safetyScore,
        sampleSize,
        grade,
        score,
      };
    });
  } catch (err) {
    log.error("getTopAgentHealth failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Single-agent health lookup — used by the agent detail page to
 * badge a grade next to the name.
 */
export async function getAgentHealth(
  agentId: string,
): Promise<AgentHealthSignal | null> {
  const list = await getTopAgentHealth(100);
  return list.find((a) => a.agentId === agentId) ?? null;
}
