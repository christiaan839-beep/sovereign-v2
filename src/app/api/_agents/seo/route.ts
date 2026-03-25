import { NextRequest, NextResponse } from "next/server";
import {
  competitorXRay,
  contentGapKiller,
  schemaAudit,
  gbpHijack,
} from "@/agents/seo-dominator";
import { fireUserWebhook } from "@/lib/webhooks";
import { requireAuth } from "@/lib/auth-guard";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(); if (auth.error) return auth.error;
  try {
    const body = await req.json();
    const { action, params } = body;

    if (!action) {
      return NextResponse.json(
        { error: "Missing required field: action" },
        { status: 400 }
      );
    }

    switch (action) {
      case "xray": {
        const { urls, business } = params || {};
        if (!urls?.length || !business) {
          return NextResponse.json(
            { error: "Missing params: urls (array) and business (string)" },
            { status: 400 }
          );
        }
        const result = await competitorXRay(urls, business);
        await fireUserWebhook("SEO Dominator", "Competitor X-Ray", result);
        return NextResponse.json(result);
      }

      case "gap": {
        const { domain, competitors, niche } = params || {};
        if (!domain || !competitors?.length || !niche) {
          return NextResponse.json(
            { error: "Missing params: domain, competitors (array), niche" },
            { status: 400 }
          );
        }
        const result = await contentGapKiller(domain, competitors, niche);
        await fireUserWebhook("SEO Dominator", "Content Gap", result);
        return NextResponse.json(result);
      }

      case "schema": {
        const { url, businessType } = params || {};
        if (!url || !businessType) {
          return NextResponse.json(
            { error: "Missing params: url and businessType" },
            { status: 400 }
          );
        }
        const result = await schemaAudit(url, businessType);
        await fireUserWebhook("SEO Dominator", "Schema Audit", result);
        return NextResponse.json(result);
      }

      case "gbp": {
        const { business, location, services } = params || {};
        if (!business || !location || !services) {
          return NextResponse.json(
            { error: "Missing params: business, location, services" },
            { status: 400 }
          );
        }
        const result = await gbpHijack(business, location, services);
        await fireUserWebhook("SEO Dominator", "GBP Hijack", result);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}. Available: xray, gap, schema, gbp` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[SEO Agent] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
