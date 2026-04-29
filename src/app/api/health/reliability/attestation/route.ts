/**
 * GET /api/health/reliability/attestation
 *
 * Round 44 — public endpoint for the latest signed reliability
 * attestation. No auth. Cached for 5 minutes (attestations are
 * signed daily; 5 min stale-while-revalidate is fine).
 *
 * Returns:
 *   {
 *     attestation: { ...full signed window... },
 *     verificationNote: "...",
 *     verifierCommand: "npx @sovereign/inspector reliability-verify ..."
 *   }
 *
 * Customers verify with:
 *   npx @sovereign/inspector reliability-verify https://sovereignmatrix.agency
 *
 * Failure mode: if Sovereign ever fabricates an attestation, the
 * inspector's signature check fails offline. Math is the truth, not
 * Sovereign's word.
 */

import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("health-reliability-attestation");

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }

  try {
    const { db } = await import("@/db");
    const { reliabilityAttestations } = await import("@/db/schema");

    const rows = await db
      .select()
      .from(reliabilityAttestations)
      .orderBy(desc(reliabilityAttestations.createdAt))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json(
        {
          attestation: null,
          note:
            "No reliability attestation has been signed yet. The daily cron " +
            "(/api/cron/sign-reliability-attestation) writes one row per UTC day.",
        },
        { status: 200 },
      );
    }

    const r = rows[0];
    return NextResponse.json(
      {
        attestation: {
          windowStart: r.windowStart.toISOString(),
          windowEnd: r.windowEnd.toISOString(),
          totalHealthSnapshots: r.totalHealthSnapshots,
          passingHealthSnapshots: r.passingHealthSnapshots,
          failingHealthSnapshots: r.failingHealthSnapshots,
          auditChainIntact: r.auditChainIntact,
          auditChainTotalRows: r.auditChainTotalRows,
          auditChainFirstBrokenId: r.auditChainFirstBrokenId,
          uptimePct: Number(r.uptimePct),
          commitmentThresholdPct: Number(r.commitmentThresholdPct),
          metCommitment: r.metCommitment,
          attestationMessage: r.attestationMessage,
          attestationSignature: r.attestationSignature,
          platformPublicKey: r.platformPublicKey,
          previousChainHash: r.previousChainHash,
          chainHash: r.chainHash,
          createdAt: r.createdAt.toISOString(),
        },
        verificationNote:
          "This attestation is Ed25519-signed by the platform master key. " +
          "Verify the signature locally — Sovereign cannot fabricate this.",
        verifierCommand:
          "npx @sovereign/inspector reliability-verify <deployment-url>",
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "public, max-age=300, s-maxage=300, stale-while-revalidate=86400",
        },
      },
    );
  } catch (err) {
    log.error("Reliability attestation lookup failed", { error: String(err) });
    return NextResponse.json(
      { error: "Failed to load attestation" },
      { status: 500 },
    );
  }
}
