/**
 * GET /api/identity/insurance/[agentId]
 *
 * Round 46 — public insurance quote endpoint. The first carrier-
 * facing AI agent action insurance quote API.
 *
 * Composes:
 *   - R40 reputation (letter grade + numeric score)
 *   - R42 credit line (effective daily limit)
 *   - Recent claims history (currently 0 — claims table is a
 *     future round; v1 quotes are baseline)
 *
 * Returns: a full PremiumQuote with the math breakdown so carriers
 * can verify offline with `npx @sovereign/inspector ...` (future).
 *
 * No auth — quotes are public (procurement-friendly). Cached 1h.
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { quotePremium, type UnderwritingInput } from "@/lib/agent-underwriting";
import type { LetterGrade } from "@/lib/agent-reputation";
import { createLogger } from "@/lib/logger";

const log = createLogger("identity-insurance");

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
    const { agentReputationScores, agentCreditLines } = await import(
      "@/db/schema"
    );

    // Fetch reputation + credit line. Both required for a quote.
    const [reputationRows, creditRows] = await Promise.all([
      db
        .select()
        .from(agentReputationScores)
        .where(eq(agentReputationScores.agentId, agentId))
        .limit(1),
      db
        .select()
        .from(agentCreditLines)
        .where(eq(agentCreditLines.agentId, agentId))
        .limit(1),
    ]);

    const reputation = reputationRows[0];
    const credit = creditRows[0];

    if (!reputation || !credit) {
      return NextResponse.json(
        {
          agentId,
          quote: null,
          note:
            "Insurance quote requires both a reputation score (R40) and " +
            "a credit line (R42). Both are computed daily; once both " +
            "exist for this agent, a quote is generated automatically.",
          missing: {
            reputation: !reputation,
            creditLine: !credit,
          },
        },
        { status: 200 },
      );
    }

    // Build the underwriting input. Claims are 0 in v1 — claims
    // table is a future round. Carriers can still get a baseline
    // quote against which they can write their own loss-experience
    // adjustments.
    const input: UnderwritingInput = {
      letterGrade: reputation.letterGrade as LetterGrade,
      numericScore: reputation.numericScore,
      effectiveDailyLimitCents: credit.effectiveDailyLimitCents,
      claimsPaid12mo: 0, // R47 will wire claims_paid table
      totalClaimsPaidCents12mo: 0,
    };
    const quote = quotePremium(input);

    return NextResponse.json(
      {
        agentId,
        quote: {
          insurable: quote.insurable,
          declineReason: quote.declineReason,
          annualPremiumCents: quote.annualPremiumCents,
          ratePer100DollarsExposurePct: quote.ratePer100DollarsExposurePct,
          perIncidentCoverageCapCents: quote.perIncidentCoverageCapCents,
          annualAggregateCapCents: quote.annualAggregateCapCents,
          perIncidentDeductibleCents: quote.perIncidentDeductibleCents,
          breakdown: quote.breakdown,
        },
        underwritingInput: input,
        verificationNote:
          "This quote is computed by a pure function (agent-underwriting.ts). " +
          "Carriers can recompute locally with @sovereign/inspector to verify " +
          "Sovereign isn't fabricating premium math.",
        carriersNote:
          "AI agent action insurance is a new line. v1 quotes use baseline " +
          "claim history (0 claims). Carriers should adjust for their own " +
          "loss experience using the published reputation + credit signals.",
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
    log.error("Insurance quote failed", { agentId, error: String(err) });
    return NextResponse.json(
      { error: "Failed to load insurance quote" },
      { status: 500 },
    );
  }
}
