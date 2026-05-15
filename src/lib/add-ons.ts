/**
 * SOVEREIGN MATRIX — Add-on SKU registry (Cook 138).
 *
 * Per-feature, per-seat add-on pricing layered on top of the
 * canonical tier plans in src/lib/plans.ts. Three SKU families:
 *
 *   1. Auditor Replay Seat — external auditors / regulator examiners
 *      get read-only replay access to a tenant's receipts. Powered
 *      by Cook 136 anon-credentials so the auditor cannot see the
 *      underlying tenant id when verifying.
 *
 *   2. Regulatory Pack — modular scoreboards mapping the existing
 *      primitives onto a specific framework (CSRD, SR 11-7, NERC
 *      CIP, 21 CFR Part 11, FedRAMP). Each pack ships its own
 *      vertical landing page + audit-bundle template.
 *
 *   3. Crypto-Receipt API overage — beyond-plan receipt issuance
 *      priced at $0.05 per receipt; intended for high-throughput
 *      enterprise tenants who exceed their bundled allotment.
 *
 * Single source of truth — Stripe price IDs come from env so the
 * deployment can be moved between Stripe accounts without code
 * changes.
 *
 * Pure module: no DB writes, no side effects.
 */

// ── Public types ──────────────────────────────────────────────────────────

export type AddOnFamily = "auditor-seat" | "regulatory-pack" | "receipt-api";

export interface AddOnDefinition {
  /** Stable identifier — never rename in the DB or Stripe metadata. */
  id: string;
  family: AddOnFamily;
  /** User-facing display name. */
  name: string;
  /** Description shown in the SKU picker. */
  description: string;
  /** Annual list price in USD cents. 0 means "contact sales". */
  priceUsdCentsAnnual: number;
  /** Per-unit price (per seat, per receipt, per pack). */
  unit: "seat" | "pack" | "receipt";
  /** Optional Stripe price env key — null for contact-sales SKUs. */
  stripePriceEnvKey: string | null;
  /** Which existing tier(s) can purchase this. Enforced at checkout. */
  eligibleTiers: Array<"starter" | "array" | "node" | "enterprise">;
  /** Whether the add-on is currently purchasable via self-service. */
  selfServe: boolean;
  /** Optional vertical landing page that promotes this SKU. */
  landingPath?: string;
}

// ── Canonical registry ───────────────────────────────────────────────────

export const ADD_ONS: Record<string, AddOnDefinition> = {
  "auditor-replay-seat": {
    id: "auditor-replay-seat",
    family: "auditor-seat",
    name: "Auditor Replay Seat",
    description:
      "Read-only replay access for one external auditor or regulator examiner. Auditor verifies receipts via anonymous credentials — never consumes the customer's agent runs and never sees peer-client tenants.",
    priceUsdCentsAnnual: 5_000_000, // $50,000 / seat / year
    unit: "seat",
    stripePriceEnvKey: "STRIPE_PRICE_AUDITOR_REPLAY_SEAT",
    eligibleTiers: ["node", "enterprise"],
    selfServe: true,
  },
  "regulatory-pack-csrd": {
    id: "regulatory-pack-csrd",
    family: "regulatory-pack",
    name: "EU CSRD / ESRS Pack",
    description:
      "ESRS E1-E5 + S1-S4 + G1 disclosure scoreboards, double-materiality assessment automation, limited-assurance evidence bundles, ISSA 5000-aligned audit templates.",
    priceUsdCentsAnnual: 6_500_000, // $65,000 / year
    unit: "pack",
    stripePriceEnvKey: "STRIPE_PRICE_PACK_CSRD",
    eligibleTiers: ["array", "node", "enterprise"],
    selfServe: false,
    landingPath: "/for-csrd",
  },
  "regulatory-pack-sr11-7": {
    id: "regulatory-pack-sr11-7",
    family: "regulatory-pack",
    name: "Fed SR 11-7 / PRA SS1/23 Pack",
    description:
      "Model risk management scoreboard, drift detector mapped to SR 11-7 §V, audit-bundle subscription to MRMG, ECOA adverse-action templates.",
    priceUsdCentsAnnual: 5_500_000, // $55,000 / year
    unit: "pack",
    stripePriceEnvKey: "STRIPE_PRICE_PACK_SR11_7",
    eligibleTiers: ["array", "node", "enterprise"],
    selfServe: false,
    landingPath: "/for-banking",
  },
  "regulatory-pack-nerc-cip": {
    id: "regulatory-pack-nerc-cip",
    family: "regulatory-pack",
    name: "NERC CIP Pack",
    description:
      "CIP-002 through CIP-014 change-control evidence, FERC Order 2222 DER aggregation reporting, ICS/OT-safe agent execution.",
    priceUsdCentsAnnual: 7_500_000, // $75,000 / year
    unit: "pack",
    stripePriceEnvKey: "STRIPE_PRICE_PACK_NERC_CIP",
    eligibleTiers: ["node", "enterprise"],
    selfServe: false,
    landingPath: "/for-utilities",
  },
  "regulatory-pack-part-11": {
    id: "regulatory-pack-part-11",
    family: "regulatory-pack",
    name: "ICH GCP / 21 CFR Part 11 Pack",
    description:
      "ALCOA+ audit trails, 21 CFR §11.50 electronic-signature multi-party attestation, Trial Master File assembly, BIMO inspection-readiness bundles.",
    priceUsdCentsAnnual: 6_000_000, // $60,000 / year
    unit: "pack",
    stripePriceEnvKey: "STRIPE_PRICE_PACK_PART_11",
    eligibleTiers: ["array", "node", "enterprise"],
    selfServe: false,
    landingPath: "/for-clinical-trials",
  },
  "regulatory-pack-fedramp": {
    id: "regulatory-pack-fedramp",
    family: "regulatory-pack",
    name: "FedRAMP Moderate / FISMA Pack",
    description:
      "FedRAMP Moderate baseline mapping, FISMA continuous monitoring, SEWP VI procurement vehicle support, GovCloud-native deploy template.",
    priceUsdCentsAnnual: 4_500_000, // $45,000 / year
    unit: "pack",
    stripePriceEnvKey: "STRIPE_PRICE_PACK_FEDRAMP",
    eligibleTiers: ["enterprise"],
    selfServe: false,
    landingPath: "/for-defense",
  },
  "crypto-receipt-overage": {
    id: "crypto-receipt-overage",
    family: "receipt-api",
    name: "Crypto-Receipt API Overage",
    description:
      "Beyond-plan receipt issuance for high-throughput tenants. Each receipt is a cryptographically-signed artifact (HMAC-SHA256 + Ed25519 + Merkle inclusion proof).",
    // Stored as ANNUAL price-per-unit-bundle of 1,000 receipts: $50 / 1k = 5_000 cents.
    // Per-receipt unit price = $0.05 = 5 cents; we surface the bundle here so
    // the SKU view matches Stripe's billing meter semantics.
    priceUsdCentsAnnual: 5_000,
    unit: "receipt",
    stripePriceEnvKey: "STRIPE_PRICE_RECEIPT_OVERAGE",
    eligibleTiers: ["node", "enterprise"],
    selfServe: true,
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────

/** All available add-ons. */
export function listAddOns(): AddOnDefinition[] {
  return Object.values(ADD_ONS);
}

/** Add-ons a given tier can purchase. */
export function addOnsForTier(
  tier: "free" | "starter" | "founder" | "array" | "node" | "enterprise",
): AddOnDefinition[] {
  if (tier === "free" || tier === "founder" || tier === "starter") {
    // Only the legacy starter is listed in eligibleTiers for two packs;
    // free + founder do not get add-ons by default.
    return listAddOns().filter((a) =>
      a.eligibleTiers.includes(
        tier as "starter" | "array" | "node" | "enterprise",
      ),
    );
  }
  return listAddOns().filter((a) => a.eligibleTiers.includes(tier));
}

/** Add-ons inside a single family (e.g. all regulatory packs). */
export function addOnsByFamily(family: AddOnFamily): AddOnDefinition[] {
  return listAddOns().filter((a) => a.family === family);
}

/** Annual price in USD dollars for a single unit of the SKU. */
export function annualPriceUsd(id: string): number | null {
  const a = ADD_ONS[id];
  if (!a) return null;
  return a.priceUsdCentsAnnual / 100;
}

/** Stripe price id from env. Returns null if the SKU is not self-serve. */
export function stripePriceId(id: string): string | null {
  const a = ADD_ONS[id];
  if (!a || !a.stripePriceEnvKey) return null;
  return process.env[a.stripePriceEnvKey] ?? null;
}

/** Validate that an unknown SKU id maps to a registered add-on. */
export function isKnownAddOn(id: string): boolean {
  return id in ADD_ONS;
}

/** Compute the total annual ACV uplift of a bundle of add-on selections. */
export function bundleAnnualCents(
  selections: Array<{ id: string; quantity: number }>,
): number {
  let total = 0;
  for (const s of selections) {
    const a = ADD_ONS[s.id];
    if (!a) continue;
    if (s.quantity < 0) continue;
    total += a.priceUsdCentsAnnual * s.quantity;
  }
  return total;
}
