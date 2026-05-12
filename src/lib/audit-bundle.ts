/**
 * SOVEREIGN MATRIX — Audit-bundle subscription (Cook 56 / Tier 4 #18)
 *
 * Compliance teams want monthly / quarterly evidence packs delivered
 * to their inbox without filing tickets. This module composes:
 *
 *   - Cook 46 scheduling (cron specs)
 *   - Cook 53 attestation letter (signed compliance summary)
 *   - Cook 55 receipt analytics (timeline buckets)
 *
 * …into a typed `AuditBundle` that the caller persists / emails.
 * Pure module: no DB, no SMTP. The caller wires those at the edge.
 *
 * Contracts:
 *
 *   - Subscriptions are tied to a tenant + cadence (monthly / quarterly).
 *   - Every bundle has a unique `bundleId` derived from
 *     `sha256(tenantId|periodStart|periodEnd)` — stable across
 *     retries and idempotent at the email / billing layer.
 *   - Each bundle embeds the signed attestation letter + a receipt-
 *     timeline summary; ALL fields are JSON-serializable.
 */

import { createHash } from "crypto";
import {
  generateAttestationLetter,
  type AttestationLetter,
  type PeriodStats,
} from "@/lib/attestation-letter";
import type { Framework } from "@/lib/compliance-mappings";
import {
  buildTimeline,
  type ReceiptSummary,
  type TimelineBucket,
} from "@/lib/receipt-analytics";
import { parseCron, nextFireAt, type CronSpec } from "@/lib/scheduling";

// ── Public types ──────────────────────────────────────────────────────────

export type Cadence = "monthly" | "quarterly";

export interface AuditSubscription {
  id: string;
  tenantId: string;
  tenantDisplayName: string;
  /** Email address(es) to deliver bundles to. */
  deliverTo: string[];
  cadence: Cadence;
  frameworks: Framework[];
  /** True = active; false = paused. */
  active: boolean;
}

export interface BundleRequest {
  subscription: AuditSubscription;
  /** Period the bundle covers — UTC, inclusive start, exclusive end. */
  periodStart: number;
  periodEnd: number;
  receipts: ReceiptSummary[];
  stats: PeriodStats;
  signingKey: string;
}

export interface AuditBundle {
  bundleId: string;
  subscriptionId: string;
  tenantId: string;
  periodStart: number;
  periodEnd: number;
  generatedAt: string;
  letter: AttestationLetter;
  timeline: TimelineBucket[];
  /** Convenience: total receipts, total drift events, pass rate. */
  summary: {
    totalReceipts: number;
    driftedReceipts: number;
    passRate: number;
  };
}

// ── Cadence → cron mapping ────────────────────────────────────────────────

const CADENCE_CRON: Record<Cadence, string> = {
  monthly: "0 7 1 * *", // 07:00 UTC on the 1st of every month
  quarterly: "0 7 1 1,4,7,10 *", // 07:00 UTC on Jan/Apr/Jul/Oct 1st
};

export function cronForCadence(cadence: Cadence): CronSpec {
  return parseCron(CADENCE_CRON[cadence]);
}

/** Compute the next bundle issuance time at or after `from`. */
export function nextBundleAt(cadence: Cadence, from: Date): Date | null {
  return nextFireAt(cronForCadence(cadence), from);
}

// ── Bundle generation ─────────────────────────────────────────────────────

function bundleIdFor(
  tenantId: string,
  periodStart: number,
  periodEnd: number,
): string {
  return createHash("sha256")
    .update(`audit-bundle|${tenantId}|${periodStart}|${periodEnd}`)
    .digest("hex");
}

/**
 * Produce an audit bundle for one subscription period. Pure (modulo
 * the caller-supplied signing key + receipts).
 */
export function generateAuditBundle(
  req: BundleRequest,
  now: Date = new Date(),
): AuditBundle {
  if (!req.subscription.active) {
    throw new Error("generateAuditBundle: subscription is paused");
  }
  if (req.periodEnd <= req.periodStart) {
    throw new Error("generateAuditBundle: periodEnd must be > periodStart");
  }
  if (req.subscription.deliverTo.length === 0) {
    throw new Error(
      "generateAuditBundle: deliverTo must have at least one address",
    );
  }

  const inWindow = req.receipts.filter(
    (r) => r.committedAt >= req.periodStart && r.committedAt < req.periodEnd,
  );

  const letter = generateAttestationLetter(
    {
      tenantId: req.subscription.tenantId,
      tenantDisplayName: req.subscription.tenantDisplayName,
      periodStart: new Date(req.periodStart).toISOString().slice(0, 10),
      periodEnd: new Date(req.periodEnd).toISOString().slice(0, 10),
      frameworks: req.subscription.frameworks,
      stats: req.stats,
      signingKey: req.signingKey,
    },
    now,
  );

  const timeline = buildTimeline({
    receipts: inWindow,
    windowStart: req.periodStart,
    windowEnd: req.periodEnd,
    granularity: "day",
  });

  const drifted = inWindow.filter((r) => r.status === "drifted").length;
  const passed = inWindow.filter((r) => r.status === "committed").length;
  const passRate = inWindow.length === 0 ? 1 : passed / inWindow.length;

  return {
    bundleId: bundleIdFor(
      req.subscription.tenantId,
      req.periodStart,
      req.periodEnd,
    ),
    subscriptionId: req.subscription.id,
    tenantId: req.subscription.tenantId,
    periodStart: req.periodStart,
    periodEnd: req.periodEnd,
    generatedAt: now.toISOString(),
    letter,
    timeline,
    summary: {
      totalReceipts: inWindow.length,
      driftedReceipts: drifted,
      passRate,
    },
  };
}
