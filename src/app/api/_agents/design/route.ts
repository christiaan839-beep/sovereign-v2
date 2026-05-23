import { createAgentRoute } from "@/lib/agent-factory";
import {
  generateLandingPageBrief,
  generateBrandIdentity,
  generateUISpec,
} from "@/agents/designer";
import { fireUserWebhook } from "@/lib/webhooks";

export const POST = createAgentRoute({
  name: "design",
  requiredFields: ["action"],
  // Wave 116 M3 batch 10: memory hooks. Per-action design history compounds
  // — last landing-page-brief or brand-identity output informs the next
  // request on the same product/brand so the visual system stays cohesive.
  memory: {
    search: {
      query: (input) => {
        const p = (input.params ?? {}) as Record<string, unknown>;
        const tag =
          typeof p.product === "string"
            ? p.product
            : typeof p.brand === "string"
              ? p.brand
              : "";
        return `design ${input.action ?? ""} ${tag}`.trim();
      },
      limit: 2,
    },
    store: {
      extract: (result) => {
        const r = result as {
          action?: string;
          summary?: string;
          primaryColor?: string;
          headline?: string;
        };
        const summary = (r.summary ?? r.headline ?? "").slice(0, 180);
        if (!summary) return null;
        return `[${r.action ?? "?"}] ${summary}${r.primaryColor ? ` color=${r.primaryColor}` : ""}`;
      },
      metadata: (input) => ({
        action: typeof input.action === "string" ? input.action : "",
        kind: "design",
      }),
    },
  },
  handler: async ({ input }) => {
    const { action, params } = input as Record<string, unknown>;
    const p = (params || {}) as Record<string, unknown>;

    switch (action) {
      case "landing-page": {
        const { product, audience, goal } = p;
        if (!product || !audience) {
          throw new Error("Missing params: product and audience");
        }
        const result = await generateLandingPageBrief(
          product as string,
          audience as string,
          goal as string,
        );
        await fireUserWebhook("Design Architect", "Landing Page", result);
        return result;
      }

      case "brand-identity": {
        const { businessName, industry, personality, targetAudience } = p;
        if (!businessName || !industry || !personality) {
          throw new Error(
            "Missing params: businessName, industry, personality",
          );
        }
        const result = await generateBrandIdentity(
          businessName as string,
          industry as string,
          personality as string,
          targetAudience as string,
        );
        await fireUserWebhook("Design Architect", "Brand Identity", result);
        return result;
      }

      case "ui-spec": {
        const { appDescription, screens, style } = p;
        if (!appDescription || !(screens as unknown[])?.length) {
          throw new Error("Missing params: appDescription and screens (array)");
        }
        const result = await generateUISpec(
          appDescription as string,
          screens as string[],
          style as string,
        );
        await fireUserWebhook("Design Architect", "UI Spec", result);
        return result;
      }

      default:
        throw new Error(
          `Unknown action: ${action}. Available: landing-page, brand-identity, ui-spec`,
        );
    }
  },
});
