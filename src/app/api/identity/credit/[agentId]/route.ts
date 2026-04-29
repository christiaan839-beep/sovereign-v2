/**
 * GET /api/identity/credit/[agentId]
 *
 * PUBLIC, no-auth lookup of an agent's credit line (Trust-as-Collateral).
 *
 * Round 42 — composes R40 reputation × R30 cost-runaway. The credit
 * line is the multiplier-modulated daily spend ceiling: a grade-A+
 * agent gets 5× the base; a grade-F agent gets 0.25×.
 *
 * Returns the credit line plus the inputs the platform claims it
 * was computed from, so a verifier can recompute the math locally.
 *
 * Cached for 1 hour — credit lines update once per day via the
 * rollup-agent-credit cron.
 *
 * The credit-line calculation is a PURE FUNCTION (`agent-credit-line.ts`)
 * and is ported to @sovereign/inspector for offline verification.
 *
 * Failure mode: if Sovereign ever publishes a credit line whose
 * effectiveDailyLimitCents doesn't match the recomputed value, the
 * inspector catches it. The platform CANNOT lie about its own
 * credit math.
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import {
  computeCreditLine,
  type CreditLine,
} from "@/lib/agent-credit-line";
import type { LetterGrade } from "@/lib/agent-reputation";
import { createLogger } from "@/lib/logger";

const log = createLogger("identity-credit");

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
    const { agentCreditLines } = await import("@/db/schema");

    const rows = await db
      .select()
      .from(agentCreditLines)
      .where(eq(agentCreditLines.agentId, agentId))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json(
        {
          agentId,
          creditLine: null,
          note:
            "No credit line computed yet. Cron rolls up daily after a " +
            "reputation score is established.",
        },
        { status: 200 },
      );
    }

    const r = rows[0];
    const multiplier = Number(r.multiplier);
    const creditLine: CreditLine = computeCreditLine({
      letterGrade: r.letterGrade as LetterGrade,
      numericScore: r.numericScore,
      baseDailyLimitCents: r.baseDailyLimitCents,
    });

    // Sanity: published row should match the recomputed line. If it
    // doesn't, the row was tampered with — surface it loudly.
    const platformIntegrityOk =
      creditLine.effectiveDailyLimitCents === r.effectiveDailyLimitCents &&
      creditLine.multiplier === multiplier;

    return NextResponse.json(
      {
        agentId,
        creditLine: {
          letterGrade: r.letterGrade,
          numericScore: r.numericScore,
          multiplier,
          baseDailyLimitCents: r.baseDailyLimitCents,
          effectiveDailyLimitCents: r.effectiveDailyLimitCents,
          framing: creditLine.framing,
          computedAt: r.computedAt.toISOString(),
        },
        platformIntegrityOk,
        verificationNote:
          "Credit line is a pure function of (grade, base, multiplier). " +
          "Verify locally with @sovereign/inspector or by recomputing: " +
          "effectiveDailyLimitCents = round(baseDailyLimitCents × multiplier).",
        wireStatus:
          "R42 publishes the credit line as a SIGNAL. R43 wires it into " +
          "cost-runaway.ts so the multiplier modifies the live spend cap.",
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
    log.error("credit lookup failed", { agentId, error: String(err) });
    return NextResponse.json(
      { error: "Failed to load credit line" },
      { status: 500 },
    );
  }
}
