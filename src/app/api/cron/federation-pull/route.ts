/**
 * GET /api/cron/federation-pull
 *
 * Periodic Vercel cron. Reads peer feeds configured in
 * FEDERATION_PEERS, applies trust + TTL + dedup gates, persists a
 * snapshot of distinct fingerprintIds to audit_logs for the guard
 * layer to consult.
 *
 * Recommended schedule: every 15-30 minutes (matches the bulletin
 * TTL strategy — more frequent than that is wasted work since peer
 * bulletins last 24h by default).
 *
 * This is the SELF-IMPROVEMENT primitive: as more peers join the
 * federation, this cron observes a strictly larger set of attack
 * fingerprints without any per-member code change. Defence improves
 * O(N) in federation size; per-member work stays O(peer-count).
 *
 * Security:
 *   - CRON_SECRET-gated (timingSafeEqual comparison)
 *   - Each peer URL is SSRF-checked and HTTPS-only before fetch
 *   - Per-peer fetch timeout (10s) prevents one slow peer from
 *     stalling the cycle
 *   - All persistence uses userId="system" — survives any user
 *     cascade in the audit_logs table
 */

import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runPullCycle } from "@/lib/federation-puller";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";

const log = createLogger("cron-federation-pull");

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  // Constant-time secret compare (mirrors wave-100 honeypot-flush).
  const secret = process.env.CRON_SECRET;
  const supplied = req.headers.get("x-cron-secret");
  if (!secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const a = Buffer.from(supplied ?? "");
  const b = Buffer.from(secret);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let cycle;
  try {
    cycle = await runPullCycle();
  } catch (err) {
    log.error("pull cycle threw at module level", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { ok: false, reason: "pull cycle failed" },
      { status: 503 },
    );
  }

  // Persist a snapshot of the cycle's results so the guard layer can
  // consult the most recent set of federated fingerprintIds without
  // re-running the pull on every request. Best-effort — never fail
  // the cron on a transient DB error.
  try {
    await auditLog({
      userId: "system",
      action: "honeypot.bulletin", // reuse the existing action; resource disambiguates
      resource: `federation-pull:${cycle.attemptedAt}`,
      details: {
        schema: "vaos-federation-pull-snapshot-v1",
        attemptedAt: cycle.attemptedAt,
        peers: cycle.peers,
        uniqueFingerprintIds: cycle.uniqueFingerprintIds.slice(0, 1000),
        totalBulletinsAccepted: cycle.totalBulletinsAccepted,
        totalFingerprintsBeforeDedup: cycle.totalFingerprintsBeforeDedup,
      },
    });
  } catch (err) {
    log.warn("snapshot persist failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  log.info("federation pull complete", {
    peersAttempted: cycle.peers.length,
    peersReached: cycle.peers.filter((p) => p.reached).length,
    distinctFingerprints: cycle.uniqueFingerprintIds.length,
  });

  return NextResponse.json({
    ok: true,
    attemptedAt: cycle.attemptedAt,
    peersAttempted: cycle.peers.length,
    peersReached: cycle.peers.filter((p) => p.reached).length,
    distinctFingerprints: cycle.uniqueFingerprintIds.length,
    totalBulletinsAccepted: cycle.totalBulletinsAccepted,
    peers: cycle.peers.map((p) => ({
      peerUrl: p.peerUrl,
      reached: p.reached,
      bulletinsAccepted: p.bulletinsAccepted,
      fingerprintsExtracted: p.fingerprintsExtracted,
    })),
  });
}
