import { NextResponse } from "next/server";

/**
 * WHITE-LABEL API — Returns branding configuration for white-label deployments.
 * Agencies can resell Sovereign Matrix under their own brand with 
 * custom domains, logos, colors, and pricing.
 */

interface WhiteLabelConfig {
  id: string;
  agency_name: string;
  domain: string;
  logo_url: string;
  primary_color: string;
  accent_color: string;
  bg_color: string;
  pricing: {
    basic: number;
    pro: number;
    enterprise: number;
    currency: string;
  };
  features_enabled: string[];
  created_at: string;
}

// In-memory config registry (production: use database)
const WHITELABEL_CONFIGS = new Map<string, WhiteLabelConfig>();

// Default Sovereign Matrix config
WHITELABEL_CONFIGS.set("default", {
  id: "default",
  agency_name: "Sovereign Matrix",
  domain: "sovereignmatrix.agency",
  logo_url: "/logo.png",
  primary_color: "#00B7FF",
  accent_color: "#00ff66",
  bg_color: "#000000",
  pricing: { basic: 9997, pro: 24997, enterprise: 49997, currency: "ZAR" },
  features_enabled: ["all"],
  created_at: "2026-01-01T00:00:00Z",
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const domain = url.searchParams.get("domain") || request.headers.get("host") || "default";

  // Find config by domain
  const config = Array.from(WHITELABEL_CONFIGS.values()).find(c => c.domain === domain) || WHITELABEL_CONFIGS.get("default")!;

  return NextResponse.json({
    status: "White-Label Engine — Active",
    config,
    total_deployments: WHITELABEL_CONFIGS.size,
  });
}

export async function POST(request: Request) {
  try {
    const { action, config } = await request.json();

    if (action === "create") {
      if (!config?.agency_name || !config?.domain) {
        return NextResponse.json({ error: "agency_name and domain are required." }, { status: 400 });
      }

      const id = `wl-${Date.now()}`;
      const newConfig: WhiteLabelConfig = {
        id,
        agency_name: config.agency_name,
        domain: config.domain,
        logo_url: config.logo_url || "/logo.png",
        primary_color: config.primary_color || "#00B7FF",
        accent_color: config.accent_color || "#00ff66",
        bg_color: config.bg_color || "#000000",
        pricing: config.pricing || { basic: 9997, pro: 24997, enterprise: 49997, currency: "ZAR" },
        features_enabled: config.features_enabled || ["all"],
        created_at: new Date().toISOString(),
      };

      WHITELABEL_CONFIGS.set(id, newConfig);

      return NextResponse.json({
        success: true,
        action: "create",
        config: newConfig,
        message: `White-label deployment created for ${newConfig.agency_name} at ${newConfig.domain}`,
      });
    }

    if (action === "list") {
      return NextResponse.json({
        deployments: Array.from(WHITELABEL_CONFIGS.values()),
        total: WHITELABEL_CONFIGS.size,
      });
    }

    return NextResponse.json({ error: "action must be 'create' or 'list'." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: "White-label error", details: String(error) }, { status: 500 });
  }
}
