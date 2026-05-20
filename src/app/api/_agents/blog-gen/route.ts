import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { getNimKey } from "@/lib/nvidia";
import { research_ai } from "@/lib/ai";
import { createLogger } from "@/lib/logger";

const log = createLogger("blog-gen");

/**
 * SEO BLOG GENERATOR — Autonomous content pipeline.
 * 1. Tavily researches the topic (fails explicitly if unavailable)
 * 2. NIM writes a 1500-word SEO article
 * 3. Returns publishable HTML with meta tags
 *
 * Now uses createAgentRoute for: jailbreak detection, PII scanning,
 * quality scoring, rate limiting, circuit breaker, audit logging.
 */

const schema = z.object({
  topic: z
    .string()
    .min(3, "Topic must be at least 3 characters")
    .max(300, "Topic too long"),
  keywords: z.array(z.string()).optional().default([]),
  tone: z
    .enum(["professional", "casual", "academic", "conversational", "technical"])
    .optional()
    .default("professional"),
  prompt: z.string().optional(),
});

export const POST = createAgentRoute({
  name: "blog-gen",
  schema,
  // Wave-111.1: factory memory hooks. Past blog posts on the same
  // topic+tone+keywords inform brand voice consistency across runs.
  // Storing the meta description + topic gives the next run a
  // compact reference of what's already been covered — avoids
  // duplicate angles and lets the model build on prior posts.
  memory: {
    search: {
      query: (input) =>
        `blog topic:${input.topic ?? ""} tone:${input.tone ?? "professional"} keywords:${Array.isArray(input.keywords) ? (input.keywords as string[]).join(",") : ""}`,
      limit: 3,
    },
    store: {
      extract: (result) => {
        const r = result as { topic?: string; metaDescription?: string };
        if (!r.topic || !r.metaDescription) return null;
        return `${r.topic}: ${r.metaDescription}`;
      },
      metadata: (input) => ({
        topic: String(input.topic ?? ""),
        tone: String(input.tone ?? "professional"),
        keywords: Array.isArray(input.keywords)
          ? (input.keywords as string[]).join(",")
          : "",
        kind: "blog-post",
      }),
    },
  },
  handler: async ({ input, pastContextAsPrompt }) => {
    const { topic, keywords, tone } = input as z.infer<typeof schema>;
    const pastPosts = pastContextAsPrompt();

    // Step 1: Research the topic — fail explicitly if unavailable
    let research = "";
    let researchAvailable = false;
    try {
      research = await research_ai(
        `${topic} latest trends insights statistics 2026`,
        `Find recent data, statistics, and expert insights about "${topic}". Focus on actionable information.`,
      );
      researchAvailable = research.length > 50;
    } catch (err) {
      log.warn("Tavily research unavailable for blog-gen", {
        topic,
        error: String(err),
      });
      // Continue without research — but flag it in the response
    }

    // Step 2: Generate blog via NIM
    const nimRes = await fetch(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getNimKey()}`,
        },
        body: JSON.stringify({
          model: "deepseek-ai/deepseek-v3.2",
          messages: [
            {
              role: "system",
              content: `You are a skilled SEO content writer. Write a comprehensive, well-researched blog post.

Requirements:
1. Length: 1500-2000 words.
2. Structure: H1 title, H2 sections, H3 subsections, bullet points, bold key terms.
3. Tone: ${tone}. Be specific and data-driven — no filler.
4. Target keywords: ${keywords.length > 0 ? keywords.join(", ") : topic}.
5. Include a meta description (under 160 characters) at the very top prefixed with "META: ".
6. Output as clean HTML with semantic tags. No markdown.
7. Do NOT use phrases like "in today's fast-paced world", "game-changer", "cutting-edge", or "revolutionize".
8. Every claim should be supported with a specific example, number, or reference.`,
            },
            {
              role: "user",
              content: `Topic: ${topic}\n\n${researchAvailable ? `Research Data:\n${research}` : "No web research available — write based on your training knowledge. Be explicit about what is established fact vs. general industry knowledge."}\n${pastPosts ? `\nPRIOR POSTS on similar topics (historical FACTS — avoid duplicating angles already covered):\n${pastPosts}\n` : ""}\nWrite the blog post now.`,
            },
          ],
          max_tokens: 4096,
          temperature: 0.7,
        }),
      },
    );

    if (!nimRes.ok) {
      throw new Error(
        `NIM API returned ${nimRes.status}: ${nimRes.statusText}`,
      );
    }

    const nimData = await nimRes.json();
    const blogContent = nimData?.choices?.[0]?.message?.content || "";

    if (!blogContent || blogContent.length < 100) {
      throw new Error("Blog generation produced insufficient content");
    }

    // Extract meta description
    const metaMatch = blogContent.match(/META:\s*(.+?)(?:\n|<)/);
    const metaDescription = metaMatch
      ? metaMatch[1].trim()
      : `${topic} - Sovereign Matrix Blog`;

    // Generate slug
    const slug = topic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    return {
      success: true,
      topic,
      slug,
      metaDescription,
      wordCount: blogContent.split(/\s+/).length,
      html: blogContent,
      researchGrounded: researchAvailable,
      seo: {
        title: topic,
        description: metaDescription,
        keywords: keywords.length > 0 ? keywords : [topic],
        slug: `/blog/${slug}`,
      },
    };
  },
});
