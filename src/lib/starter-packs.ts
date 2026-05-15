/**
 * SOVEREIGN MATRIX — Starter-pack SKU registry (Cook 149).
 *
 * Small-ticket SKUs ($99-$999) the visitor can buy without a sales
 * call. Distinct from src/lib/add-ons.ts which is enterprise-tier
 * add-on inventory; these are self-serve revenue generators sized
 * for a Stripe Payment Link rather than a checkout-session flow.
 *
 * Each SKU is one of:
 *   - "kit" — one-time digital delivery (templates, scripts, Loom)
 *   - "hour" — bookable consulting hour pack
 *   - "audit" — one-time audit report
 *   - "trial" — trial subscription that converts after N days
 *
 * Pure module. Caller wires the Stripe Payment Link env to each id.
 */

// ── Public types ──────────────────────────────────────────────────────────

export type StarterFamily = "kit" | "hour" | "audit" | "trial";

export interface StarterPack {
  id: string;
  family: StarterFamily;
  name: string;
  blurb: string;
  /** One-time price in USD cents. */
  priceUsdCents: number;
  /** Headline value units (e.g. "1 audit report", "4 consulting hours"). */
  unitLabel: string;
  /** Env key holding the Stripe Payment Link URL — null if not wired. */
  stripeLinkEnvKey: string | null;
  /** Who buys this. */
  audience: string;
  /** Why this is worth it — single sentence. */
  pitch: string;
  /** Inferred CTA URL when no Stripe link is configured. */
  contactFallback: string;
}

export const STARTER_PACKS: Record<string, StarterPack> = {
  "verify-your-agent": {
    id: "verify-your-agent",
    family: "audit",
    name: "Verify-Your-Agent Audit",
    blurb:
      "We take one of your existing AI agent endpoints and ship back a signed Sovereign receipt + a 1-page verification report you can show your compliance team.",
    priceUsdCents: 49_900,
    unitLabel: "1 endpoint audited",
    stripeLinkEnvKey: "STRIPE_LINK_VERIFY_AGENT",
    audience:
      "Engineers / Heads of Compliance / CISOs at any company shipping AI in a regulated workflow.",
    pitch:
      "Walks you through what a Sovereign receipt looks like on YOUR endpoint without committing to a full migration.",
    contactFallback: "/contact?intent=verify-agent",
  },
  "crypto-receipts-kit": {
    id: "crypto-receipts-kit",
    family: "kit",
    name: "Cryptographic Receipts Implementation Kit",
    blurb:
      "Download the canonical projection spec + reference TypeScript implementation + verifier CLI + 3 worked-example receipts. Self-host the same crypto primitives Sovereign uses.",
    priceUsdCents: 19_900,
    unitLabel: "Spec + code + CLI",
    stripeLinkEnvKey: "STRIPE_LINK_RECEIPTS_KIT",
    audience: "Engineers building any AI verification pipeline in-house.",
    pitch:
      "Saves you 3 weeks of crypto-primitive design and verification-CLI implementation.",
    contactFallback: "/contact?intent=receipts-kit",
  },
  "regulatory-pack-template": {
    id: "regulatory-pack-template",
    family: "kit",
    name: "Regulatory Pack Templates (pick 1)",
    blurb:
      "Pre-mapped JSON template for one of: CSRD ESRS · SR 11-7 · 21 CFR Part 11 · ICH GCP · NERC CIP · NAIC AI Bias · FedRAMP. Includes the control catalog, evidence-bundle schema, and 3 worked example mappings.",
    priceUsdCents: 99_900,
    unitLabel: "1 regulatory framework",
    stripeLinkEnvKey: "STRIPE_LINK_PACK_TEMPLATE",
    audience: "Heads of Compliance, Audit, or Risk owning ONE framework.",
    pitch:
      "Cuts your initial control-mapping effort from 6 weeks of internal effort to 1 day of customization.",
    contactFallback: "/contact?intent=pack-template",
  },
  "advisory-pack-4h": {
    id: "advisory-pack-4h",
    family: "hour",
    name: "Cryptographic AI Verification Advisory · 4-hour pack",
    blurb:
      "Four bookable advisory hours with the founder. Covers receipt design, control mapping, auditor-facing presentation, and the one-pager for your CFO.",
    priceUsdCents: 99_900,
    unitLabel: "4 × 60-minute calls",
    stripeLinkEnvKey: "STRIPE_LINK_ADVISORY_4H",
    audience:
      "CTOs / VP Eng / Compliance teams scoping a verification rollout.",
    pitch: "Rate works out to $250/hr — half the enterprise consulting rate.",
    contactFallback: "/contact?intent=advisory-4h",
  },
  "advisory-pack-1h": {
    id: "advisory-pack-1h",
    family: "hour",
    name: "Founder 1:1 · single hour",
    blurb:
      "One 60-minute call with the founder. Live walk-through of your specific use case, primitives you'd need, and an opinionated next-step plan.",
    priceUsdCents: 29_900,
    unitLabel: "1 × 60-minute call",
    stripeLinkEnvKey: "STRIPE_LINK_ADVISORY_1H",
    audience: "Anyone evaluating Sovereign vs. building in-house.",
    pitch:
      "The cheapest way to find out whether the crypto-receipts approach makes sense for your stack.",
    contactFallback: "/contact?intent=advisory-1h",
  },
  "receipts-api-trial": {
    id: "receipts-api-trial",
    family: "trial",
    name: "Crypto-Receipts API · 30-day trial",
    blurb:
      "30 days of API access for issuing + verifying signed receipts. 10,000 receipts included. Auto-cancels at trial end unless you upgrade.",
    priceUsdCents: 9_900,
    unitLabel: "10K receipts / 30 days",
    stripeLinkEnvKey: "STRIPE_LINK_API_TRIAL",
    audience: "Engineers prototyping a verification layer.",
    pitch:
      "$99 buys 30 days of real cryptographic primitives without an annual commit.",
    contactFallback: "/contact?intent=api-trial",
  },
  "whitepaper-bundle": {
    id: "whitepaper-bundle",
    family: "kit",
    name: "Auditor Whitepaper Bundle",
    blurb:
      "Three whitepapers + a 15-minute Loom walkthrough of the cryptographic primitives. Mapped to ESRS, SR 11-7, and 21 CFR Part 11.",
    priceUsdCents: 9_900,
    unitLabel: "3 whitepapers + Loom",
    stripeLinkEnvKey: "STRIPE_LINK_WHITEPAPER_BUNDLE",
    audience: "Compliance teams building the internal case for procurement.",
    pitch:
      "The materials your Director of Compliance needs to brief their auditor + CFO.",
    contactFallback: "/contact?intent=whitepaper",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────

export function listStarterPacks(): StarterPack[] {
  return Object.values(STARTER_PACKS);
}

export function packsByFamily(family: StarterFamily): StarterPack[] {
  return listStarterPacks().filter((p) => p.family === family);
}

export function isKnownStarterPack(id: string): boolean {
  return id in STARTER_PACKS;
}

export function stripeLinkFor(id: string): string | null {
  const p = STARTER_PACKS[id];
  if (!p || !p.stripeLinkEnvKey) return null;
  return process.env[p.stripeLinkEnvKey] ?? null;
}

/**
 * Resolve the CTA URL: prefer the Stripe Payment Link when configured,
 * fall back to the contact endpoint so the visitor still has a path.
 */
export function ctaFor(id: string): { url: string; payable: boolean } {
  const p = STARTER_PACKS[id];
  if (!p) return { url: "/contact", payable: false };
  const link = stripeLinkFor(id);
  if (link) return { url: link, payable: true };
  return { url: p.contactFallback, payable: false };
}

export function annualPriceUsd(id: string): number | null {
  const p = STARTER_PACKS[id];
  if (!p) return null;
  return p.priceUsdCents / 100;
}
