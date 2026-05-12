/**
 * SOVEREIGN MATRIX — Third-party agent marketplace (Cook 62 / Tier 4 #16)
 *
 * Devs ship agents on Sovereign infra and get a revenue cut. This
 * module is the pure core: listing validation, price gating, revenue
 * split math, and approval state machine. Caller wires the
 * `marketplaceAgents` table + Stripe Connect on top.
 *
 * Contracts:
 *
 *   - LISTING SCHEMA — slug must match the same regex as built-in
 *     agents (snake/dash lowercase) so they share the unified
 *     `/api/agents/<slug>` surface.
 *   - REVENUE SPLIT — platform fee is configurable (default 30 %);
 *     developer receives the remainder. Computation is in cents,
 *     banker's-rounded, never negative.
 *   - APPROVAL STATE MACHINE — draft → submitted → approved →
 *     published; rejection / unpublish transitions explicit. Invalid
 *     transitions return a structured error.
 *   - SAFETY ATTESTATION — every published listing must declare which
 *     of the 6 verifier layers it relies on. Listings that opt out
 *     of all verifiers cannot reach `published`.
 */

import { bankersRound } from "@/lib/billing-math";

// ── Public types ──────────────────────────────────────────────────────────

export type ListingStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "published"
  | "rejected"
  | "unpublished";

export type SafetyLayer =
  | "jailbreak"
  | "content-safety"
  | "pii"
  | "quality"
  | "critic"
  | "hallucination";

export interface MarketplaceListing {
  slug: string;
  developerId: string;
  /** Human-readable name shown in the catalog. */
  displayName: string;
  /** Short description (≤ 280 chars). */
  description: string;
  /** Per-run price in cents. >= 0. */
  pricePerRunCents: number;
  /** Status in the approval state machine. */
  status: ListingStatus;
  /** Safety layers the listing relies on (must be non-empty when published). */
  safetyLayers: SafetyLayer[];
  /** Optional ISO timestamp of the last status change. */
  updatedAt?: string;
}

export interface RevenueSplit {
  totalCents: number;
  platformCents: number;
  developerCents: number;
  platformFeeFraction: number;
}

export interface TransitionResult {
  ok: boolean;
  listing?: MarketplaceListing;
  reason?:
    | "invalid-transition"
    | "missing-safety-layer"
    | "invalid-listing"
    | "invalid-price";
  details?: string;
}

// ── Listing validation ────────────────────────────────────────────────────

const SLUG_RE = /^[a-z][a-z0-9-]{1,63}$/;
const MAX_DESCRIPTION = 280;
const MAX_DISPLAY_NAME = 80;
const MAX_PRICE_CENTS = 100_000_000; // $1M ceiling — sanity gate.

const ALLOWED_TRANSITIONS: Record<ListingStatus, ListingStatus[]> = {
  draft: ["submitted"],
  submitted: ["approved", "rejected"],
  approved: ["published", "rejected"],
  published: ["unpublished"],
  rejected: ["draft"],
  unpublished: ["published", "draft"],
};

export function validateListing(
  listing: MarketplaceListing,
): { ok: true } | { ok: false; reason: string } {
  if (!SLUG_RE.test(listing.slug)) {
    return { ok: false, reason: "slug must match /^[a-z][a-z0-9-]{1,63}$/" };
  }
  if (
    !listing.developerId ||
    listing.developerId.length < 1 ||
    listing.developerId.length > 128
  ) {
    return { ok: false, reason: "developerId is required" };
  }
  if (!listing.displayName || listing.displayName.length > MAX_DISPLAY_NAME) {
    return {
      ok: false,
      reason: `displayName required, max ${MAX_DISPLAY_NAME} chars`,
    };
  }
  if (listing.description.length > MAX_DESCRIPTION) {
    return {
      ok: false,
      reason: `description max ${MAX_DESCRIPTION} chars`,
    };
  }
  if (
    !Number.isInteger(listing.pricePerRunCents) ||
    listing.pricePerRunCents < 0 ||
    listing.pricePerRunCents > MAX_PRICE_CENTS
  ) {
    return {
      ok: false,
      reason: `pricePerRunCents must be an integer in [0, ${MAX_PRICE_CENTS}]`,
    };
  }
  return { ok: true };
}

// ── Revenue split ─────────────────────────────────────────────────────────

/**
 * Split a total amount between platform and developer. Banker's-
 * rounded so half-cents never leak in one direction. Validates the
 * fee fraction (0..1) and rejects negative inputs.
 */
export function splitRevenue(
  totalCents: number,
  platformFeeFraction = 0.3,
): RevenueSplit {
  if (
    !Number.isInteger(totalCents) ||
    totalCents < 0 ||
    totalCents > MAX_PRICE_CENTS
  ) {
    throw new Error(
      `splitRevenue: totalCents must be an integer in [0, ${MAX_PRICE_CENTS}]`,
    );
  }
  if (platformFeeFraction < 0 || platformFeeFraction > 1) {
    throw new Error("splitRevenue: platformFeeFraction must be in [0, 1]");
  }
  const platformCents = bankersRound(totalCents * platformFeeFraction);
  // Assigning the remainder to the developer guarantees
  // platform + developer === total — no off-by-one cents.
  const developerCents = totalCents - platformCents;
  return {
    totalCents,
    platformCents,
    developerCents,
    platformFeeFraction,
  };
}

// ── State machine ────────────────────────────────────────────────────────

/**
 * Transition a listing's status. Pure — caller persists the result.
 * Enforces:
 *   - Listing validates BEFORE any transition.
 *   - Transition is in ALLOWED_TRANSITIONS.
 *   - Promoting to `published` requires at least one safety layer.
 */
export function transition(
  listing: MarketplaceListing,
  target: ListingStatus,
  now: Date = new Date(),
): TransitionResult {
  const validation = validateListing(listing);
  if (!validation.ok) {
    return {
      ok: false,
      reason: "invalid-listing",
      details: validation.reason,
    };
  }
  const allowed = ALLOWED_TRANSITIONS[listing.status] ?? [];
  if (!allowed.includes(target)) {
    return {
      ok: false,
      reason: "invalid-transition",
      details: `${listing.status} → ${target} is not a permitted transition`,
    };
  }
  if (target === "published" && listing.safetyLayers.length === 0) {
    return {
      ok: false,
      reason: "missing-safety-layer",
      details:
        "Listings must declare at least one safety layer before reaching published",
    };
  }
  if (target === "published" && listing.pricePerRunCents === 0) {
    // Free listings are still valid economically but can't be PUBLISHED to
    // a paid catalog tier — surface that explicitly so the caller can
    // decide whether to promote into a free showcase tier.
    return {
      ok: false,
      reason: "invalid-price",
      details: "pricePerRunCents > 0 required for published listings",
    };
  }
  return {
    ok: true,
    listing: {
      ...listing,
      status: target,
      updatedAt: now.toISOString(),
    },
  };
}

export const MARKETPLACE_CONSTANTS = {
  SLUG_RE,
  MAX_DESCRIPTION,
  MAX_DISPLAY_NAME,
  MAX_PRICE_CENTS,
  ALLOWED_TRANSITIONS,
};
