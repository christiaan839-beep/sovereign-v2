/**
 * GET /api/vertical-packs/[packId]
 *
 * Round 47 — public endpoint for vertical agent packs. Procurement-
 * readable: returns the full opinionated bundle for an industry,
 * including which agents are enabled, what HITL rules apply, what
 * audit queries are pre-built, and which compliance frameworks the
 * pack maps to.
 *
 * No auth — packs are part of the public product surface (the buyer
 * checks this BEFORE engaging sales).
 *
 * Cached 1 hour. Packs are immutable per version; the (id, version)
 * tuple uniquely identifies the artifact a customer receives.
 */

import { NextResponse } from "next/server";
import { getBankingCompliancePack } from "@/lib/vertical-packs/banking-compliance";
import { getHealthcareClaimsPack } from "@/lib/vertical-packs/healthcare-claims";
import { getLegalDiscoveryPack } from "@/lib/vertical-packs/legal-discovery";
import { getHrHiringCompliancePack } from "@/lib/vertical-packs/hr-hiring-compliance";
import { getFedrampGovernmentPack } from "@/lib/vertical-packs/fedramp-government";
import { getWorkforceTransformationPack } from "@/lib/vertical-packs/workforce-transformation";
import { getManufacturingIndustrialPack } from "@/lib/vertical-packs/manufacturing-industrial";
import { getItCybersecurityPack } from "@/lib/vertical-packs/it-cybersecurity";
import type { VerticalPack } from "@/lib/vertical-packs/types";

export const runtime = "nodejs";
export const revalidate = 3600;

const PACKS: Record<string, () => VerticalPack> = {
  "banking-compliance": getBankingCompliancePack,
  "banking-compliance-v1": getBankingCompliancePack,
  "healthcare-claims": getHealthcareClaimsPack,
  "healthcare-claims-v1": getHealthcareClaimsPack,
  "legal-discovery": getLegalDiscoveryPack,
  "legal-discovery-v1": getLegalDiscoveryPack,
  "hr-hiring-compliance": getHrHiringCompliancePack,
  "hr-hiring-compliance-v1": getHrHiringCompliancePack,
  "fedramp-government": getFedrampGovernmentPack,
  "fedramp-government-v1": getFedrampGovernmentPack,
  "workforce-transformation": getWorkforceTransformationPack,
  "workforce-transformation-v1": getWorkforceTransformationPack,
  "manufacturing-industrial": getManufacturingIndustrialPack,
  "manufacturing-industrial-v1": getManufacturingIndustrialPack,
  "it-cybersecurity": getItCybersecurityPack,
  "it-cybersecurity-v1": getItCybersecurityPack,
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ packId: string }> },
) {
  const { packId } = await params;
  const factory = PACKS[packId];
  if (!factory) {
    return NextResponse.json(
      {
        error: "Vertical pack not found",
        availablePacks: Object.keys(PACKS).filter(
          (k) => k === k.replace(/-v\d+$/, ""),
        ),
      },
      { status: 404 },
    );
  }
  const pack = factory();
  return NextResponse.json(
    {
      pack,
      verificationNote:
        "Pack contents are immutable per (id, version). Customers receive " +
        "EXACTLY this configuration on signup. Any HITL rule, allowlisted " +
        "agent, or compliance-framework mapping listed here is auditable in " +
        "the source: src/lib/vertical-packs/.",
      orderingNote:
        "To purchase this pack: contact sales@sovereignmatrix.agency. " +
        "Pricing tier: " +
        `$${pack.pricingTier.minAcvUsd.toLocaleString()}–` +
        `$${pack.pricingTier.maxAcvUsd.toLocaleString()} ACV.`,
    },
    {
      status: 200,
      headers: {
        "Cache-Control":
          "public, max-age=3600, s-maxage=3600, stale-while-revalidate=14400",
      },
    },
  );
}
