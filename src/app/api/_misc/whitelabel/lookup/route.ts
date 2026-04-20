import { NextResponse } from "next/server";
import { resolveWhitelabel } from "@/lib/whitelabel-resolver";

/**
 * GET /api/_misc/whitelabel/lookup?domain=<hostname>
 *
 * Public endpoint — returns the branding config for a given white-label
 * domain. Used by the portal layout to render agency-specific colors,
 * logo, and name without round-tripping through Clerk auth.
 *
 * No secrets exposed: the response contains only display-level fields
 * (agencyName, logoUrl, primaryColor, supportEmail). Ownership info
 * (userEmail, tenantId) is NEVER returned here.
 *
 * Returns 404 if the domain isn't registered so the caller can fall
 * back to the default Sovereign Matrix branding.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const domain = url.searchParams.get("domain")?.trim().toLowerCase();
  if (!domain) {
    return NextResponse.json({ error: "Missing `domain` query param" }, { status: 400 });
  }

  const brand = await resolveWhitelabel(domain);
  if (!brand) {
    return NextResponse.json({ error: "Domain not registered" }, { status: 404 });
  }

  // Strip ownership-scoped fields — callers of this public endpoint
  // should never see who owns the domain.
  return NextResponse.json({
    agencyName: brand.agencyName,
    logoUrl: brand.logoUrl,
    primaryColor: brand.primaryColor,
    supportEmail: brand.supportEmail,
    domain: brand.domain,
  }, {
    headers: {
      // 5 minutes at the edge — matches the resolver's in-memory TTL.
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
