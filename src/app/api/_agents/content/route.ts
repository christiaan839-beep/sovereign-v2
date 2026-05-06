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
  handler: async ({ input }) => {
    const { action, params } = input as Record<string, any>;
    const p = (params || {}) as Record<string, any>;

    switch (action) {
      case "blog": {
        const { topic, keywords, tone } = p;
        if (!topic) {
          throw new Error("Missing params: topic (keywords optional as array, tone optional)");
        }
        const result = await generateBlogPost(topic as string, (keywords || []) as string[], tone as string);
        await fireUserWebhook("Content Factory", "Blog Post", result);
        return result;
      }

      case "email": {
        const { product, audience, steps } = p;
        if (!product || !audience) {
          throw new Error("Missing params: product and audience");
        }
        const result = await generateEmailSequence(product as string, audience as string, steps as number);
        await fireUserWebhook("Content Factory", "Email Sequence", result);
        return result;
      }

      case "social": {
        const { topic, platforms } = p;
        if (!topic) {
          throw new Error("Missing params: topic");
        }
        const result = await generateSocialPack(topic as string, platforms as string[]);
        await fireUserWebhook("Content Factory", "Social Pack", result);
        return result;
      }

      case "video": {
        const { topic, duration, style } = p;
        if (!topic) {
          throw new Error("Missing params: topic");
        }
        const result = await generateVideoScript(topic as string, duration as string, style as string);
        await fireUserWebhook("Content Factory", "Video Script", result);
        return result;
      }

      default:
        throw new Error(`Unknown action: ${action}. Available: blog, email, social, video`);
    }
  },
});
