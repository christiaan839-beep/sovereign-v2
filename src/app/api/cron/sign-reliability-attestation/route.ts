/**
 * GET /api/cron/sign-reliability-attestation
 *
 * Round 44 — daily cron that computes the 24h reliability window,
 * signs it with the platform master key, persists to
 * `reliability_attestations`, and chains it to the previous row.
 *
 * Auth: verifyCron (timing-safe, fail-closed).
 *
 * Why daily, not real-time:
 *   - Reliability claims should be stable enough to graph.
 *   - Real-time signing creates whipsaw during an outage.
 *   - Daily cadence aligns with R40/R42 (reputation, credit lines).
 *
 * NEVER 5xxs unless catastrophic. The cron is a steady producer of
 * reliability commitments, not a critical path.
 */

import { NextResponse } from "next/server";
import { gte, lt, and, desc } from "drizzle-orm";
import { verifyCron } from "@/lib/cron-auth";
import {
  computeReliabilityWindow,
  signAttestation,
  getPlatformSigningKey,
} from "@/lib/reliability-attestation";
import { createLogger } from "@/lib/logger";

const log = createLogger("cron:sign-reliability-attestation");

export const runtime = "nodejs";
export const maxDuration = 60;

interface RollupResult {
  windowStart: string;
  windowEnd: string;
  totalHealthSnapshots: number;
  uptimePct: number;
  metCommitment: boolean;
  signed: boolean;
  durationMs: number;
}

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
    const { platformHealthSnapshots, reliabilityAttestations } = await import(
      "@/db/schema"
    );

    // 24h window ending at now (rounded to the previous full hour
    // for window-determinism — re-running the cron in the same hour
    // produces an identical message + signature).
    const now = new Date();
    const windowEnd = new Date(now);
    windowEnd.setUTCMinutes(0, 0, 0);
    const windowStart = new Date(windowEnd.getTime() - 24 * 60 * 60 * 1000);

    // Pull every health snapshot in the window.
    const snapshots = await db
      .select({
        healthy: platformHealthSnapshots.healthy,
        invariantsFailing: platformHealthSnapshots.invariantsFailing,
      })
      .from(platformHealthSnapshots)
      .where(
        and(
          gte(platformHealthSnapshots.createdAt, windowStart),
          lt(platformHealthSnapshots.createdAt, windowEnd),
        ),
      );

    // Compute the window aggregate (pure function).
    const window = computeReliabilityWindow({
      windowStart,
      windowEnd,
      healthSnapshots: snapshots,
      // Audit chain integrity wiring: future round will read the
      // verify-audit-chain cron's most recent result. For now we
      // honestly mark it as `null` (unknown) rather than fabricate.
      auditChainIntact: null,
      auditChainTotalRows: null,
      auditChainFirstBrokenId: null,
    });

    // Find the previous attestation row's chain hash for chaining.
    const prevRows = await db
      .select({ chainHash: reliabilityAttestations.chainHash })
      .from(reliabilityAttestations)
      .orderBy(desc(reliabilityAttestations.createdAt))
      .limit(1);
    const previousChainHash = prevRows[0]?.chainHash ?? null;

    // Sign with the platform master key.
    const { privateKey, publicKey, source } = getPlatformSigningKey();
    if (source === "cached_dev") {
      log.warn(
        "Signing reliability attestation with EPHEMERAL dev key. " +
          "Set SOVEREIGN_PLATFORM_PRIVATE_KEY + SOVEREIGN_PLATFORM_PUBLIC_KEY " +
          "for reproducible signatures across deploys.",
      );
    }
    const signed = signAttestation({
      window,
      platformPrivateKey: privateKey,
      platformPublicKey: publicKey,
      previousChainHash,
    });

    // Persist.
    await db.insert(reliabilityAttestations).values({
      windowStart: new Date(signed.windowStart),
      windowEnd: new Date(signed.windowEnd),
      totalHealthSnapshots: signed.totalHealthSnapshots,
      passingHealthSnapshots: signed.passingHealthSnapshots,
      failingHealthSnapshots: signed.failingHealthSnapshots,
      auditChainIntact: signed.auditChainIntact,
      auditChainTotalRows: signed.auditChainTotalRows,
      auditChainFirstBrokenId: signed.auditChainFirstBrokenId,
      uptimePct: String(signed.uptimePct),
      metCommitment: signed.metCommitment,
      commitmentThresholdPct: String(signed.commitmentThresholdPct),
      attestationMessage: signed.attestationMessage,
      attestationSignature: signed.attestationSignature,
      platformPublicKey: signed.platformPublicKey,
      previousChainHash: signed.previousChainHash,
      chainHash: signed.chainHash,
    });

    const result: RollupResult = {
      windowStart: signed.windowStart,
      windowEnd: signed.windowEnd,
      totalHealthSnapshots: signed.totalHealthSnapshots,
      uptimePct: signed.uptimePct,
      metCommitment: signed.metCommitment,
      signed: true,
      durationMs: Date.now() - start,
    };

    log.info("Reliability attestation signed + persisted", { ...result });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    log.error("Reliability attestation cron failed", { error: String(err) });
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
