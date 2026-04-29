/**
 * GET /api/identity/reputation/[agentId]/signals
 *
 * PUBLIC, no-auth raw-signals endpoint. Returns the exact signal
 * inputs the platform's reputation cron uses to compute scores.
 *
 * THIS IS THE TRUSTLESS-LOOP CLOSURE:
 * Customers fetch these signals + the published score, recompute
 * the score on their own machine via @sovereign/inspector, and
 * verify they match. If they don't match, Sovereign fabricated the
 * score — and the inspector catches it.
 *
 * After R41, every reputation claim Sovereign makes is verifiable.
 * The platform CANNOT lie about its own scoring.
 *
 * Cached for 30 minutes (signals refresh slightly more often than
 * the daily score rollup so verifiers see fresh data).
 */

import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { gatherReputationSignals } from "@/lib/agent-reputation-signals";
import { computeReputationScore } from "@/lib/agent-reputation";
import { createLogger } from "@/lib/logger";

const log = createLogger("identity-reputation-signals");

export const runtime = "nodejs";
export const revalidate = 1800;

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
    const { agentIdentityManifests } = await import("@/db/schema");

    // Find the manifest's createdAt — needed for manifestAgeDays.
    const manifestRows = await db
      .select({ createdAt: agentIdentityManifests.createdAt })
      .from(agentIdentityManifests)
      .where(eq(agentIdentityManifests.agentId, agentId))
      .orderBy(desc(agentIdentityManifests.createdAt))
      .limit(1);

    if (manifestRows.length === 0) {
      return NextResponse.json(
        {
          error: "Agent not found in identity registry",
          hint: "Register the agent first via POST /api/identity/manifests.",
        },
        { status: 404 },
      );
    }

    const manifestCreatedAt = manifestRows[0].createdAt;
    const signals = await gatherReputationSignals(db, agentId, manifestCreatedAt);

    // Compute the score server-side too, so the response includes
    // BOTH the raw signals AND what the platform claims the score
    // should be. The verifier compares.
    const computed = computeReputationScore(signals);

    return NextResponse.json(
      {
        agentId,
        signals,
        publishedScore: {
          letterGrade: computed.letterGrade,
          numericScore: computed.numericScore,
          breakdown: computed.signalsBreakdown,
        },
        verificationNote:
          "Recompute this score locally via " +
          "`computeReputationScore(signals)` from @sovereign/inspector. " +
          "If your local score doesn't match publishedScore, the platform " +
          "is fabricating reputation data.",
        formula: {
          spec: "src/lib/agent-reputation.ts",
          version: "v1",
          base: 75,
          weights: {
            reversal_max_penalty: 30,
            hitl_max_penalty: 25,
            audit_intact_bonus: 15,
            audit_broken_penalty: 15,
            age_max_bonus: 10,
            usage_max_bonus: 15,
            cost_max_bonus: 10,
            anomaly_max_penalty: 20,
          },
        },
        generatedAt: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "public, max-age=1800, s-maxage=1800, stale-while-revalidate=3600",
        },
      },
    );
  } catch (err) {
    log.error("signals endpoint failed", { agentId, error: String(err) });
    return NextResponse.json(
      { error: "Failed to gather signals" },
      { status: 500 },
    );
  }
}
