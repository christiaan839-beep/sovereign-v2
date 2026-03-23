import { nimChat, getNimKey } from "@/lib/nvidia";
import { NextResponse } from "next/server";

/**
 * SEO BLOG AUTO-GENERATOR — Autonomous content pipeline.
 * 1. Tavily researches the topic
 * 2. NIM writes a 1500-word SEO article
 * 3. Returns publishable HTML with meta tags
 */

export async function POST(request: Request) {
  try {
    const { topic, keywords = [], tone = "professional" } = await request.json();

    if (!topic) {
      return NextResponse.json({ error: "topic is required." }, { status: 400 });
    }
    const tavilyKey = process.env.TAVILY_API_KEY;

    // Step 1: Research the topic via Tavily
    let research = "";
    if (tavilyKey) {
      const tavilyRes = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: `${topic} latest trends insights statistics 2026`,
          search_depth: "advanced",
          max_results: 5,
          include_answer: true,
        }),
      });
      const tavilyData = await tavilyRes.json();
      research = tavilyData.answer || tavilyData.results?.map((r: { content: string }) => r.content).join("\n\n") || "";
    }

    // Step 2: Generate the blog post via NIM

    const nimRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${await getNimKey()}`,
      },
      body: JSON.stringify({
        model: "deepseek-ai/deepseek-v3.2",
        messages: [
          {
            role: "system",
            content: `You are an elite SEO content writer for Sovereign Matrix, the world's most advanced AI agency platform. Write a comprehensive, SEO-optimized blog post. Requirements:
1. Length: 1500-2000 words.
2. Structure: H1 title, H2 sections, H3 subsections, bullet points, bold key terms.
3. Tone: ${tone}. Authoritative, data-driven, no fluff.
4. Include statistics and data points from the research provided.
5. Target keywords: ${keywords.join(", ") || topic}.
6. End with a strong CTA directing readers to Sovereign Matrix.
7. Include a meta description (under 160 characters) at the very top prefixed with "META: ".
8. Output as clean HTML with semantic tags. No markdown.`,
          },
          {
            role: "user",
            content: `Topic: ${topic}\n\nResearch Data:\n${research}\n\nWrite the blog post now.`,
          },
        ],
        max_tokens: 4096,
        temperature: 0.7,
      }),
    });

    const nimData = await nimRes.json();
    const blogContent = nimData?.choices?.[0]?.message?.content || "";

    // Extract meta description
    const metaMatch = blogContent.match(/META:\s*(.+?)(?:\n|<)/);
    const metaDescription = metaMatch ? metaMatch[1].trim() : `${topic} - Sovereign Matrix Blog`;

    // Generate slug
    const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

    return NextResponse.json({
      success: true,
      topic,
      slug,
      metaDescription,
      wordCount: blogContent.split(/\s+/).length,
      html: blogContent,
      research_sources: research ? research.substring(0, 500) + "..." : "No research data",
      seo: {
        title: topic,
        description: metaDescription,
        keywords: keywords.length > 0 ? keywords : [topic],
        slug: `/blog/${slug}`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Blog generator error", details: String(error) }, { status: 500 });
  }
}
