import { createAgentRoute } from "@/lib/agent-factory";
import {
  competitorXRay,
  contentGapKiller,
  schemaAudit,
  gbpOptimize,
} from "@/agents/seo-dominator";
import { fireUserWebhook } from "@/lib/webhooks";

export const POST = createAgentRoute({
  name: "seo",
  requiredFields: ["action"],
  handler: async ({ input }) => {
    const { action, params } = input as Record<string, unknown>;
    const p = (params || {}) as Record<string, unknown>;

    switch (action) {
      case "xray": {
        const { urls, business } = p;
        if (!(urls as unknown[])?.length || !business) {
          throw new Error("Missing params: urls (array) and business (string)");
        }
        const result = await competitorXRay(urls as string[], business as string);
        await fireUserWebhook("SEO Dominator", "Competitor X-Ray", result);
        return result;
      }

      case "gap": {
        const { domain, competitors, niche } = p;
        if (!domain || !(competitors as unknown[])?.length || !niche) {
          throw new Error("Missing params: domain, competitors (array), niche");
        }
        const result = await contentGapKiller(domain as string, competitors as string[], niche as string);
        await fireUserWebhook("SEO Dominator", "Content Gap", result);
        return result;
      }

      case "schema": {
        const { url, businessType } = p;
        if (!url || !businessType) {
          throw new Error("Missing params: url and businessType");
        }
        const result = await schemaAudit(url as string, businessType as string);
        await fireUserWebhook("SEO Dominator", "Schema Audit", result);
        return result;
      }

      case "gbp": {
        const { business, location, services } = p;
        if (!business || !location || !services) {
          throw new Error("Missing params: business, location, services");
        }
        const result = await gbpOptimize(business as string, location as string, services as string);
        await fireUserWebhook("SEO Dominator", "GBP Hijack", result);
        return result;
      }

      default:
        throw new Error(`Unknown action: ${action}. Available: xray, gap, schema, gbp`);
    }
  },
});
