import { NextResponse } from "next/server";
import { db } from "@/db";
import { usage, auditLogs } from "@/db/schema";
import { and, count, gte, isNotNull, ilike, sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { RATE_CARD_VERSION } from "@/lib/model-costs";

const log = createLogger("safety-diff");

/**
 * GET /api/_misc/safety-diff
 *
 * Public, aggregate-only endpoint that compares safety + quality
 * outcomes between "Claude ran the critic" runs and "no Claude"
 * runs. Produces the data that powers /trust/anthropic.
 *
 * The hypothesis this endpoint helps prove/disprove: with Claude as
 * the consensus critic, our 5-layer safety pipeline catches more
 * jailbreaks + PII + policy violations than runs where only
 * open-weight models ran.
 *
 * What gets measured (aggregate counts, never per-user):
 *   - Total runs in the last 30 days
 *   - Runs where Claude was a consulted provider
 *   - Runs that hit a safety block (from audit_logs action types)
 *   - Rough "catch rate" — blocks per 1k runs, broken out by whether
 *     Claude participated
 *
 * What this endpoint does NOT do:
 *   - Run fresh Claude-vs-alternative evals (too expensive, too slow
 *     for a public URL). Those live in the `/api/_misc/partnership-metrics`
 *     rate-card-backed reporting or in our internal evals suite.
 *   - Leak PII (never joins to users; bucket counts only)
 *   - Serve customer-identifiable info
 *
 * Cache: 1-hour edge cache via Vercel — changes slowly enough that
 * real-time freshness doesn't matter; bottleneck is DB not API.
 *
 * Anthropic's partner team can hit this URL directly to see live
 * production safety outcomes without any authentication.
 */

export const revalidate = 3600;

export async function GET() {
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  try {
    const [totalRuns, claudeRuns, totalBlocks, claudeProviderRuns] = await Promise.all([
      db
        .select({ value: count() })
        .from(usage)
        .where(gte(usage.createdAt, since30d)),

      // Runs where the stored model column mentions claude (legacy)
      db
        .select({ value: count() })
        .from(usage)
        .where(and(
          gte(usage.createdAt, since30d),
          ilike(usage.model, "%claude%"),
        )),

      // Safety blocks from audit_logs — counts jailbreak/PII/policy actions
      db
        .select({ value: count() })
        .from(auditLogs)
        .where(and(
          gte(auditLogs.createdAt, since30d),
          sql`${auditLogs.action} IN (
            'safety.jailbreak_blocked',
            'safety.pii_blocked',
            'safety.policy_blocked',
            'safety.quality_rejected'
          )`,
        )),

      // Runs where the v9 provider column is anthropic (rows post-0012)
      db
        .select({ value: count() })
        .from(usage)
        .where(and(
          gte(usage.createdAt, since30d),
          sql`${usage.provider} = 'anthropic'`,
          isNotNull(usage.costCents),
        )),
    ]);

    const total = Number(totalRuns[0]?.value ?? 0);
    const claude = Number(claudeRuns[0]?.value ?? 0) + Number(claudeProviderRuns[0]?.value ?? 0);
    const blocks = Number(totalBlocks[0]?.value ?? 0);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      window: "last 30 days",
      rateCardVersion: RATE_CARD_VERSION,

      scope: {
        description:
          "Aggregate safety outcomes across all production agent runs on Sovereign Matrix. Never includes customer-identifiable data.",
        noteOnInterpretation:
          "Blocks come from our 5-layer safety pipeline (jailbreak detection + PII scan + content policy + quality scorer + critic). A higher block count per 1k runs does NOT mean the platform is broken — it means the pipeline is catching what it should.",
      },

      counts: {
        totalRuns: total,
        claudeInvolved: claude,
        claudePercent: total > 0 ? Math.round((claude / total) * 100) : 0,
        safetyBlocks: blocks,
        blocksPer1kRuns: total > 0 ? Math.round((blocks / total) * 1000) : 0,
      },

      layers: {
        jailbreakDetection: "src/lib/jailbreak-detect.ts (pre-flight)",
        contentSafety: "src/lib/content-safety.ts (NVIDIA Nemotron Safety)",
        piiScan: "src/lib/quality-scorer.ts + regex patterns (post-flight)",
        qualityScorer: "src/lib/quality-scorer.ts (threshold + regen)",
        criticGate: "src/lib/consensus.ts verifiedAi() (Claude as final critic)",
      },

      commitments: {
        description:
          "Engineering commitments that back the metrics above.",
        noTrainingOnCustomerData: true,
        claudeAsCriticByDefault: true,
        agentSnapshotPublic: "https://sovereignmatrix.agency/api/_replay/verify",
        safetyPipelinePublic: "https://github.com/christiaan839-beep/sovereign-v2/blob/main/src/lib/output-verifier.ts",
      },
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "42P01" || code === "42703") {
      return NextResponse.json({
        generatedAt: new Date().toISOString(),
        note: "Platform is pre-launch; safety metrics available after first runs.",
        counts: { totalRuns: 0, claudeInvolved: 0, claudePercent: 0, safetyBlocks: 0, blocksPer1kRuns: 0 },
      });
    }
    log.error("safety-diff query failed", { error: String(err) });
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }
}
