/**
 * GET /api/trust/snapshot
 *
 * PUBLIC endpoint — anyone can hit it. Returns the platform's
 * current cryptographic trust posture:
 *
 *   - Yesterday's Merkle root (publishable on Twitter / IPFS / Git)
 *   - The 7-day cohort commitment (selective-disclosure claim)
 *   - The public verifier spec string (so external code can verify)
 *   - The conformance public-key fingerprint
 *
 * No secrets leak — only data already public-by-construction. Cached
 * 5 minutes to keep DB load bounded under hot traffic.
 */
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import { buildDailyRoot } from "@/lib/merkle-receipts";
import { db } from "@/db";
import { agentRuns } from "@/db/schema";
import { and, gt, lt, eq, count } from "drizzle-orm";

const log = createLogger("trust-snapshot");

const limiter = rateLimit({ interval: 60, limit: 30 });

interface TrustSnapshot {
  generatedAt: string;
  /** Yesterday's UTC date. */
  date: string;
  /** Daily Merkle root payload. */
  merkle: {
    spec: string;
    root: string;
    leafCount: number;
    firstLeafId?: string;
    lastLeafId?: string;
  };
  /** Last-7-day cohort claim. */
  cohort: {
    window: { start: string; end: string };
    countBracket: { floor: number; ceiling: number };
    approvalBracket: { low: number; high: number };
    publicClaim: string;
  };
  /** Public verifier spec / where to find code. */
  verifier: {
    spec: string;
    leafPrefix: string;
    internalNodePrefix: string;
    hash: string;
    repoPath: string;
  };
  /** Conformance public-key SHA-256 fingerprint (last 16 hex chars). */
  conformance: {
    publicKeyFingerprint: string | null;
  };
}

export async function GET(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const isoYesterday = yesterday.toISOString().slice(0, 10);

  // 7-day cohort window ending yesterday (inclusive)
  const cohortEnd = new Date(yesterday);
  const cohortStart = new Date(yesterday);
  cohortStart.setUTCDate(cohortStart.getUTCDate() - 6);

  let merkle: TrustSnapshot["merkle"] = {
    spec: "sovereign-merkle-v1",
    root: "",
    leafCount: 0,
  };
  let cohort: TrustSnapshot["cohort"] = {
    window: {
      start: cohortStart.toISOString().slice(0, 10),
      end: cohortEnd.toISOString().slice(0, 10),
    },
    countBracket: { floor: 0, ceiling: 1 },
    approvalBracket: { low: 0, high: 0 },
    publicClaim: "No receipts in the public window yet.",
  };

  // ─── Yesterday's Merkle root ──────────────────────────────────────
  try {
    const root = await buildDailyRoot(yesterday);
    merkle = {
      spec: "sovereign-merkle-v1 · sha256 · RFC9162-style",
      root: root.root,
      leafCount: root.leafCount,
      firstLeafId: root.firstLeafId,
      lastLeafId: root.lastLeafId,
    };
  } catch (err) {
    log.warn("merkle root failed", { error: String(err) });
  }

  // ─── 7-day cohort summary ─────────────────────────────────────────
  try {
    const startMs = new Date(
      Date.UTC(
        cohortStart.getUTCFullYear(),
        cohortStart.getUTCMonth(),
        cohortStart.getUTCDate(),
      ),
    );
    const exclusiveEnd = new Date(
      Date.UTC(
        cohortEnd.getUTCFullYear(),
        cohortEnd.getUTCMonth(),
        cohortEnd.getUTCDate(),
      ) +
        24 * 60 * 60 * 1000,
    );

    const totalRows = await db
      .select({ c: count() })
      .from(agentRuns)
      .where(
        and(
          gt(agentRuns.createdAt, startMs),
          lt(agentRuns.createdAt, exclusiveEnd),
        ),
      );
    const approvedRows = await db
      .select({ c: count() })
      .from(agentRuns)
      .where(
        and(
          gt(agentRuns.createdAt, startMs),
          lt(agentRuns.createdAt, exclusiveEnd),
          eq(agentRuns.trustDecision, "auto-approved"),
        ),
      );

    const total = Number(totalRows[0]?.c ?? 0);
    const approved = Number(approvedRows[0]?.c ?? 0);
    const rate = total === 0 ? 0 : approved / total;

    const countBracket = powerOfTenBracket(total);
    const approvalBracket = rateDecileBracket(rate);

    cohort = {
      window: {
        start: cohortStart.toISOString().slice(0, 10),
        end: cohortEnd.toISOString().slice(0, 10),
      },
      countBracket,
      approvalBracket,
      publicClaim:
        total === 0
          ? "No receipts in the public window yet."
          : `Sovereign Matrix signed between ${countBracket.floor.toLocaleString()} and ${countBracket.ceiling.toLocaleString()} agent runs in ${cohortStart.toISOString().slice(0, 10)} → ${cohortEnd.toISOString().slice(0, 10)}, with ${Math.round(approvalBracket.low * 100)}–${Math.round(approvalBracket.high * 100)}% auto-approval rate.`,
    };
  } catch (err) {
    log.warn("cohort summary failed", { error: String(err) });
  }

  // ─── Conformance key fingerprint (file is committed in the repo) ──
  let publicKeyFingerprint: string | null = null;
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const crypto = await import("node:crypto");
    const pemPath = path.join(
      process.cwd(),
      "packages",
      "verifiable-receipts",
      "conformance",
      "public-key.pem",
    );
    const pem = await fs.readFile(pemPath, "utf8");
    publicKeyFingerprint = crypto
      .createHash("sha256")
      .update(pem)
      .digest("hex")
      .slice(0, 16);
  } catch {
    // Key file missing in the deployed bundle is fine — frontend
    // shows "not provisioned" instead of crashing.
  }

  const snapshot: TrustSnapshot = {
    generatedAt: new Date().toISOString(),
    date: isoYesterday,
    merkle,
    cohort,
    verifier: {
      spec: "sovereign-merkle-v1",
      leafPrefix: "0x00",
      internalNodePrefix: "0x01",
      hash: "SHA-256",
      repoPath: "src/lib/merkle-receipts.ts",
    },
    conformance: { publicKeyFingerprint },
  };

  return NextResponse.json(snapshot, {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=300" },
  });
}

// Inlined helpers — keep this route self-contained
function powerOfTenBracket(n: number): { floor: number; ceiling: number } {
  if (n <= 0) return { floor: 0, ceiling: 1 };
  const log = Math.log10(n);
  const lower = Math.pow(10, Math.floor(log));
  const upper = Math.pow(10, Math.floor(log) + 1);
  return { floor: lower, ceiling: upper };
}
function rateDecileBracket(rate: number): { low: number; high: number } {
  if (rate < 0) return { low: 0, high: 0 };
  if (rate >= 1) return { low: 0.9, high: 1.0 };
  const decile = Math.floor(rate * 10);
  return { low: decile / 10, high: (decile + 1) / 10 };
}
