/**
 * SOVEREIGN MATRIX — White-label per-domain pricing (Cook 57 / Tier 4 #20)
 *
 * Per-customer pricing rules for white-label deployments. An agency
 * can sell the platform under their own brand at their own price; we
 * collect a markup. This module:
 *
 *   1. Resolves a domain → tenant via a caller-supplied resolver.
 *   2. Applies per-domain rate limits (separate buckets from the
 *      global Upstash limiter).
 *   3. Computes the per-run charge using either a flat $/run rate or
 *      a markup-over-cost formula.
 *
 * Pure module — no I/O. Caller wires the actual DB lookup + rate
 * limiter.
 */

import { bankersRound } from "@/lib/billing-math";

// ── Public types ──────────────────────────────────────────────────────────

export type PricingModel =
  | { kind: "flat"; centsPerRun: number }
  | { kind: "markup"; markupFraction: number };

export interface WhitelabelConfig {
  domain: string;
  tenantId: string;
  /** Resolved pricing strategy. */
  pricing: PricingModel;
  /** Per-domain rate limit in runs per minute. */
  rateLimitRpm: number;
  /** Optional minimum charge floor (cents). Defaults to 1. */
  minimumCents?: number;
  /** Optional maximum charge ceiling (cents). Empty = no cap. */
  maximumCents?: number;
}

export interface RateBucketState {
  /** Existing token count in the bucket (caller persists). */
  tokens: number;
  /** Last refill timestamp (Unix ms). */
  lastRefillMs: number;
}

export interface PricingDecision {
  domain: string;
  tenantId: string;
  /** Cents the customer is billed for this run. */
  chargeCents: number;
  /** Cents the run cost the platform — pass-through from caller. */
  costCents: number;
  /** Margin = charge - cost. May be negative when min/max clamps bite. */
  marginCents: number;
  /** Whether the run was allowed by the rate limiter. */
  allowed: boolean;
  /** Resolved bucket state — caller persists. */
  bucket: RateBucketState;
  reason?: "ok" | "rate-limited" | "missing-config";
}

// ── Pricing math ──────────────────────────────────────────────────────────

/**
 * Compute the charge cents for one run under the given config and
 * the platform's cost-to-serve (cents). Clamps to min/max if set.
 */
export function chargeFor(config: WhitelabelConfig, costCents: number): number {
  let charge: number;
  if (config.pricing.kind === "flat") {
    charge = config.pricing.centsPerRun;
  } else {
    if (config.pricing.markupFraction < 0) {
      throw new Error("chargeFor: markupFraction must be >= 0");
    }
    charge = bankersRound(costCents * (1 + config.pricing.markupFraction));
  }
  const floor = config.minimumCents ?? 1;
  if (charge < floor) charge = floor;
  if (config.maximumCents !== undefined && charge > config.maximumCents) {
    charge = config.maximumCents;
  }
  return charge;
}

// ── Token-bucket rate limiter (in-memory, deterministic) ──────────────────

/**
 * Refill + try-take exactly one token. Pure function — caller
 * persists the returned bucket state for the next call.
 */
export function tryTakeToken(
  bucket: RateBucketState,
  capacityPerMinute: number,
  now: number,
): { allowed: boolean; bucket: RateBucketState } {
  if (capacityPerMinute <= 0) {
    return { allowed: false, bucket };
  }
  const refillRatePerMs = capacityPerMinute / 60_000;
  const elapsedMs = Math.max(0, now - bucket.lastRefillMs);
  let tokens = Math.min(
    capacityPerMinute,
    bucket.tokens + elapsedMs * refillRatePerMs,
  );
  if (tokens < 1) {
    return {
      allowed: false,
      bucket: { tokens, lastRefillMs: now },
    };
  }
  tokens -= 1;
  return {
    allowed: true,
    bucket: { tokens, lastRefillMs: now },
  };
}

// ── Combined decision ────────────────────────────────────────────────────

/**
 * Single entry point: rate-limit the request AND compute the charge.
 * Returns a structured `PricingDecision` callers persist to the
 * usage table.
 */
export function priceAndLimit(
  config: WhitelabelConfig | null,
  costCents: number,
  bucket: RateBucketState,
  now: number,
): PricingDecision {
  if (!config) {
    return {
      domain: "",
      tenantId: "",
      chargeCents: 0,
      costCents,
      marginCents: -costCents,
      allowed: false,
      bucket,
      reason: "missing-config",
    };
  }
  const { allowed, bucket: next } = tryTakeToken(
    bucket,
    config.rateLimitRpm,
    now,
  );
  if (!allowed) {
    return {
      domain: config.domain,
      tenantId: config.tenantId,
      chargeCents: 0,
      costCents,
      marginCents: 0,
      allowed: false,
      bucket: next,
      reason: "rate-limited",
    };
  }
  const charge = chargeFor(config, costCents);
  return {
    domain: config.domain,
    tenantId: config.tenantId,
    chargeCents: charge,
    costCents,
    marginCents: charge - costCents,
    allowed: true,
    bucket: next,
    reason: "ok",
  };
}
