import { createAgentRoute } from "@/lib/agent-factory";
import {
  generateBlogPost,
  generateEmailSequence,
  generateSocialPack,
  generateVideoScript,
} from "@/agents/content-factory";
import { fireUserWebhook } from "@/lib/webhooks";

export const POST = createAgentRoute({
  name: "content",
  requiredFields: ["action"],
  // Wave 118 M3 batch 13: memory hooks. Per-action+topic content history
  // compounds — last blog/post/script on a similar topic informs which
  // angles + hooks already shipped so the model produces fresh variants.
  memory: {
    search: {
      query: (input) => {
        const p = (input.params ?? {}) as Record<string, unknown>;
        const topic =
          typeof p.topic === "string"
            ? p.topic
            : typeof p.subject === "string"
              ? p.subject
              : "";
        return `content ${input.action ?? ""} ${topic.slice(0, 100)}`.trim();
      },
      limit: 2,
    },
    store: {
      extract: (result) => {
        const r = result as {
          action?: string;
          headline?: string;
          summary?: string;
          wordCount?: number;
        };
        const head = r.headline ?? r.summary?.slice(0, 200) ?? "";
        if (!head) return null;
        return `[${r.action ?? "?"}] ${head}${r.wordCount ? ` (${r.wordCount}w)` : ""}`;
      },
      metadata: (input) => ({
        action: typeof input.action === "string" ? input.action : "",
        kind: "content",
      }),
    },
  },
  handler: async ({ input }) => {
    const { action, params } = input as Record<string, unknown>;
    const p = (params || {}) as Record<string, unknown>;

    switch (action) {
      case "blog": {
        const { topic, keywords, tone } = p;
        if (!topic) {
          throw new Error(
            "Missing params: topic (keywords optional as array, tone optional)",
          );
        }
        const result = await generateBlogPost(
          topic as string,
          (keywords || []) as string[],
          tone as string,
        );
        await fireUserWebhook("Content Factory", "Blog Post", result);
        return result;
      }

      case "email": {
        const { product, audience, steps } = p;
        if (!product || !audience) {
          throw new Error("Missing params: product and audience");
        }
        const result = await generateEmailSequence(
          product as string,
          audience as string,
          steps as number,
        );
        await fireUserWebhook("Content Factory", "Email Sequence", result);
        return result;
      }

      case "social": {
        const { topic, platforms } = p;
        if (!topic) {
          throw new Error("Missing params: topic");
        }
        const result = await generateSocialPack(
          topic as string,
          platforms as string[],
        );
        await fireUserWebhook("Content Factory", "Social Pack", result);
        return result;
      }

      case "video": {
        const { topic, duration, style } = p;
        if (!topic) {
          throw new Error("Missing params: topic");
        }
        const result = await generateVideoScript(
          topic as string,
          duration as string,
          style as string,
        );
        await fireUserWebhook("Content Factory", "Video Script", result);
        return result;
      }

      default:
        throw new Error(
          `Unknown action: ${action}. Available: blog, email, social, video`,
        );
    }
  },
});
