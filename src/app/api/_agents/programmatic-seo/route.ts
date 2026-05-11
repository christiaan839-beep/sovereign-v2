import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";
import { fireUserWebhook } from "@/lib/webhooks";

/**
 * Programmatic SEO Swarm API
 *
 * Discovers keyword gaps, generates full SEO-optimized blog posts,
 * and provides schema markup.
 */

const SEO_SWARM_PROMPT = `You are an SEO strategist and content engineer. You analyze search intent, identify content gaps, and generate long-form posts that rank for the target keyword.

${ANTI_SLOP_RULES}

## SEO CONTENT RULES
1. Every post MUST include JSON-LD schema markup (Article type)
2. Title must contain primary keyword naturally within first 5 words
3. Use H2/H3 hierarchy that mirrors People Also Ask questions
4. Include internal linking placeholders [INTERNAL_LINK: topic]
5. Meta description: 155 chars, includes keyword, ends with value proposition
6. Minimum 5 semantic LSI keywords woven naturally throughout
7. Include at least 1 original data point or statistic
8. FAQ section with 3-5 questions AND structured data`;

export const POST = createAgentRoute({
  name: "programmatic-seo",
  requiredFields: ["action"],
  handler: async ({ input }) => {
    const { action, niche, difficulty, keyword, contentAngle } =
      input as Record<string, unknown>;

    if (action === "discover") {
      const discoveryPrompt = `You are a keyword research expert. Discover 8 high-intent, low-competition keyword opportunities for the niche: "${niche || "AI marketing automation"}".

Filter by difficulty: ${difficulty || "Low - Medium (Long Tail)"}

For each keyword, provide:
1. keyword: The exact search query
2. estimatedVolume: Monthly search volume estimate (e.g., "8.2k")
3. difficulty: Low, Medium, or Hard
4. intent: Informational, Commercial, Transactional, or Navigational
5. contentAngle: The specific angle that would win this SERP
6. currentTopResult: What the #1 result looks like (weakness to exploit)

Respond in JSON array format: [{ keyword, estimatedVolume, difficulty, intent, contentAngle, currentTopResult }]

Be realistic with volume estimates. Target keywords that a new domain could realistically rank for within 90 days.`;

      const result = await ai(discoveryPrompt, {
        system: SEO_SWARM_PROMPT,
        maxTokens: 2000,
      });

      let keywords;
      try {
        const cleaned = result
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();
        keywords = JSON.parse(cleaned);
      } catch {
        keywords = [
          {
            keyword: niche,
            estimatedVolume: "N/A",
            difficulty: "Medium",
            intent: "Informational",
            contentAngle: "Comprehensive guide",
            currentTopResult: "Generic article",
          },
        ];
      }

      return { success: true, keywords };
    }

    if (action === "generate") {
      const generatePrompt = `Write a comprehensive, SEO-optimized blog post targeting the keyword: "${keyword || niche}"

CONTENT ANGLE: ${contentAngle || "Authoritative guide"}
WORD COUNT: 2,000-2,400 words

Include:
1. SEO METADATA:
   - Title tag (50-60 chars, keyword in first 5 words)
   - Meta description (155 chars max)
   - URL slug suggestion

2. FULL ARTICLE with:
   - Hook intro (2-3 sentences, no throat-clearing)
   - 5-7 H2 sections with descriptive headings
   - At least 3 H3 sub-sections
   - 1 data table or comparison chart (markdown format)
   - 1 expert quote (attributed to a real thought leader)
   - Internal link suggestions: [INTERNAL_LINK: topic]
   - External link suggestions: [SOURCE: url description]

3. FAQ SECTION (3-5 questions based on "People Also Ask")

4. JSON-LD SCHEMA MARKUP (Article type, fully valid)

Format: Output the complete post in clean markdown.`;

      const post = await ai(generatePrompt, {
        system: SEO_SWARM_PROMPT,
        maxTokens: 4000,
      });

      await fireUserWebhook("ProgrammaticSEO", "PostGenerated", {
        keyword: keyword || niche,
      });

      return { success: true, post, keyword: keyword || niche };
    }

    throw new Error("Invalid action. Use: discover, generate");
  },
});
