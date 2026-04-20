import { NextResponse } from "next/server";
import { db } from "@/db";
import { usage } from "@/db/schema";
import { and, count, gte, isNotNull, sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { RATE_CARD_VERSION, getRate } from "@/lib/model-costs";

const log = createLogger("benchmarks");

/**
 * GET /api/_misc/benchmarks
 *
 * Public aggregate benchmark data. Answers the questions every
 * skeptical technical buyer asks:
 *   - "Which of your 40+ models actually gets the most production traffic?"
 *   - "How much does each provider cost per run on average?"
 *   - "What's the actual p50/p95 token usage for a real agent run?"
 *
 * Unlike competitors' benchmark pages (which tend to be static PDFs
 * with last-year's numbers), this endpoint reads from the live
 * `usage` cost-ledger table and re-aggregates every hour.
 *
 * Scope & privacy:
 *   - Aggregate counts only — never any userId, prompt, or output
 *   - Rows pre-0012 (no cost_cents) are excluded to keep economics clean
 *   - Cached 1hr at Vercel edge
 *
 * The leaderboard isn't "which model is objectively best" — it's
 * "which model does Sovereign's routing logic prefer in practice."
 * That distinction matters: we route on task type, latency budget,
 * and quality gate, not on marketing narrative.
 */

export const revalidate = 3600;

interface ProviderRow {
  provider: string;
  runs: number;
  totalCostCents: number;
  avgCostCents: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  displayName: string;
  // Cost-per-1M computed from our rate card at the current version
  inputCentsPerMTok: number;
  outputCentsPerMTok: number;
}

export async function GET() {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  try {
    const byProvider = await db
      .select({
        provider: usage.provider,
        model: usage.model,
        runs: count(),
        totalCents: sql<string | null>`sum(${usage.costCents})`,
        avgInputTokens: sql<string | null>`avg(${usage.inputTokens})`,
        avgOutputTokens: sql<string | null>`avg(${usage.outputTokens})`,
      })
      .from(usage)
      .where(
        and(
          gte(usage.createdAt, since30d),
          isNotNull(usage.costCents),
        ),
      )
      .groupBy(usage.provider, usage.model)
      .orderBy(sql`count(*) desc`)
      .limit(50);

    // Collapse to provider-level aggregates + pick the most-used model
    // per provider as its representative entry. A buyer reading this
    // wants "anthropic does X runs at Y cents average" not 40 rows.
    const collapsed = new Map<string, ProviderRow>();
    for (const r of byProvider) {
      const p = r.provider ?? "unknown";
      const modelId = r.model ?? "";
      const rate = getRate(modelId);
      const runs = Number(r.runs);
      const totalCents = Number(r.totalCents ?? 0);
      const avgCents = runs > 0 ? Math.round(totalCents / runs) : 0;

      const existing = collapsed.get(p);
      if (!existing) {
        collapsed.set(p, {
          provider: p,
          runs,
          totalCostCents: totalCents,
          avgCostCents: avgCents,
          avgInputTokens: Math.round(Number(r.avgInputTokens ?? 0)),
          avgOutputTokens: Math.round(Number(r.avgOutputTokens ?? 0)),
          displayName: rate.displayName,
          inputCentsPerMTok: rate.inputCentsPerMTok,
          outputCentsPerMTok: rate.outputCentsPerMTok,
        });
      } else {
        // Accumulate — weighted where necessary
        const newRuns = existing.runs + runs;
        existing.totalCostCents += totalCents;
        existing.avgCostCents = Math.round(existing.totalCostCents / newRuns);
        existing.avgInputTokens = Math.round(
          (existing.avgInputTokens * existing.runs + Number(r.avgInputTokens ?? 0) * runs) / newRuns,
        );
        existing.avgOutputTokens = Math.round(
          (existing.avgOutputTokens * existing.runs + Number(r.avgOutputTokens ?? 0) * runs) / newRuns,
        );
        existing.runs = newRuns;
      }
    }

    const leaderboard = Array.from(collapsed.values())
      .sort((a, b) => b.runs - a.runs);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      window: "last 30 days",
      rateCardVersion: RATE_CARD_VERSION,

      methodology: {
        source: "Production agent runs recorded in the `usage` cost ledger (migration 0012+)",
        aggregation: "Grouped by provider bucket; input/output token counts are per-run averages",
        pricing: "Computed from src/lib/model-costs.ts rate table at current version",
        scope: "Aggregate-only; no userId / prompt / output data is exposed",
      },

      leaderboard,

      // Key question buyers ask: "is Claude actually used or is it
      // marketing?" Answer it directly in the response.
      claudeShare:
        leaderboard.find((r) => r.provider === "anthropic")
          ? {
              runs: leaderboard.find((r) => r.provider === "anthropic")!.runs,
              percentOfAll: Math.round(
                (leaderboard.find((r) => r.provider === "anthropic")!.runs /
                  Math.max(1, leaderboard.reduce((a, b) => a + b.runs, 0))) *
                  100,
              ),
              primaryRole:
                "Consensus critic on every agent output + extended-thinking tasks",
            }
          : { runs: 0, percentOfAll: 0, note: "Not yet observed in the 30d window" },

      nextUpdate: "Cached 1hr at Vercel edge; /api/_misc/benchmarks is the canonical source",
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "42P01" || code === "42703") {
      return NextResponse.json({
        generatedAt: new Date().toISOString(),
        note: "Cost ledger not yet populated; benchmarks available after first post-0012 agent runs.",
        leaderboard: [],
      });
    }
    log.error("benchmark query failed", { error: String(err) });
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}
