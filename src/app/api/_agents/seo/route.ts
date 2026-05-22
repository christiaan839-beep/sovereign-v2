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
  // Wave 118 M3 batch 13: memory hooks. Per-action+business SEO history
  // compounds — last xray/content-plan output informs the next request
  // on the same business so the model surfaces deltas not restated work.
  memory: {
    search: {
      query: (input) => {
        const p = (input.params ?? {}) as Record<string, unknown>;
        const biz =
          typeof p.business === "string"
            ? p.business
            : typeof p.domain === "string"
              ? p.domain
              : "";
        return `seo ${input.action ?? ""} ${biz}`.trim();
      },
      limit: 2,
    },
    store: {
      extract: (result) => {
        const r = result as {
          action?: string;
          summary?: string;
          score?: number;
        };
        if (!r.summary) return null;
        return `[${r.action ?? "?"}] ${r.summary.slice(0, 200).replace(/\s+/g, " ")}${r.score ? ` (score=${r.score})` : ""}`;
      },
      metadata: (input) => ({
        action: typeof input.action === "string" ? input.action : "",
        kind: "seo",
      }),
    },
  },
  handler: async ({ input }) => {
    const { action, params } = input as Record<string, unknown>;
    const p = (params || {}) as Record<string, unknown>;

    switch (action) {
      case "xray": {
        const { urls, business } = p;
        if (!(urls as unknown[])?.length || !business) {
          throw new Error("Missing params: urls (array) and business (string)");
        }
        const result = await competitorXRay(
          urls as string[],
          business as string,
        );
        await fireUserWebhook("SEO Dominator", "Competitor X-Ray", result);
        return result;
      }

      case "gap": {
        const { domain, competitors, niche } = p;
        if (!domain || !(competitors as unknown[])?.length || !niche) {
          throw new Error("Missing params: domain, competitors (array), niche");
        }
        const result = await contentGapKiller(
          domain as string,
          competitors as string[],
          niche as string,
        );
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
        const result = await gbpOptimize(
          business as string,
          location as string,
          services as string,
        );
        await fireUserWebhook("SEO Dominator", "GBP Hijack", result);
        return result;
      }

      default:
        throw new Error(
          `Unknown action: ${action}. Available: xray, gap, schema, gbp`,
        );
    }
  },
});
