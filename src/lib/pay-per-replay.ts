/**
 * SOVEREIGN MATRIX — Pay-per-replay metering (Cook 48 / Tier 4 #17)
 *
 * Microbilling for receipt verification API. External consumers pay a
 * micro-fee per replay; internal callers (the receipt holder + their
 * org) are free. Pure module: it computes pricing + idempotency keys.
 * The actual money movement is the caller's job (Stripe charge,
 * platform credits, etc.).
 *
 * Pricing model:
 *
 *   - Base: $0.01 per replay (1 cent), configurable.
 *   - First N replays per receipt per consumer: FREE (promotional).
 *   - Volume discount above M replays/day per consumer.
 *
 * Each meter request returns either:
 *   - `{ chargeable: false, reason: "internal" | "free-tier" }`
 *   - `{ chargeable: true, cents, idempotencyKey }`
 *
 * Idempotency: the key is a stable hash of (consumerId, receiptId,
 * UTC-day). Two replays of the same receipt by the same consumer
 * within 24 h dedupe — bills once.
 */

import { createHash } from "crypto";

// ── Public types ──────────────────────────────────────────────────────────

export interface MeterRequest {
  consumerId: string;
  receiptId: string;
  /**
   * "internal" = same tenant as the receipt owner; never charged.
   * "external" = any other authenticated consumer.
   */
  relation: "internal" | "external";
  /** Unix ms of the replay event. */
  occurredAt: number;
  /** Replays this consumer has made TODAY across all receipts. */
  dailyReplayCountSoFar: number;
}

export type MeterOutcome =
  | { chargeable: false; reason: "internal" | "free-tier"; cents: 0 }
  | {
      chargeable: true;
      cents: number;
      idempotencyKey: string;
      tier: "base" | "volume-discount";
    };

export interface MeterConfig {
  /** Base price per replay in cents. Default 1. */
  baseCents?: number;
  /** Free replays per consumer per UTC day. Default 10. */
  freeTierDailyReplays?: number;
  /** Daily threshold above which volume discount kicks in. Default 1000. */
  volumeDiscountThreshold?: number;
  /** Volume discount fraction (0..1). Default 0.5 (50 %). */
  volumeDiscountFraction?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function utcDayKey(unixMs: number): string {
  const d = new Date(unixMs);
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, "0"),
    String(d.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function idempotencyKeyFor(req: MeterRequest): string {
  const day = utcDayKey(req.occurredAt);
  return createHash("sha256")
    .update(`replay|${req.consumerId}|${req.receiptId}|${day}`)
    .digest("hex");
}

// ── Public API ────────────────────────────────────────────────────────────

export function meterReplay(
  req: MeterRequest,
  config: MeterConfig = {},
): MeterOutcome {
  const base = config.baseCents ?? 1;
  const freeTier = config.freeTierDailyReplays ?? 10;
  const discountAt = config.volumeDiscountThreshold ?? 1000;
  const discountFrac = clampFraction(config.volumeDiscountFraction ?? 0.5);

  if (req.relation === "internal") {
    return { chargeable: false, reason: "internal", cents: 0 };
  }
  if (req.dailyReplayCountSoFar < freeTier) {
    return { chargeable: false, reason: "free-tier", cents: 0 };
  }
  if (req.dailyReplayCountSoFar >= discountAt) {
    const cents = Math.max(1, Math.round(base * (1 - discountFrac)));
    return {
      chargeable: true,
      cents,
      idempotencyKey: idempotencyKeyFor(req),
      tier: "volume-discount",
    };
  }
  return {
    chargeable: true,
    cents: base,
    idempotencyKey: idempotencyKeyFor(req),
    tier: "base",
  };
}

function clampFraction(f: number): number {
  if (f < 0) return 0;
  if (f > 1) return 1;
  return f;
}
