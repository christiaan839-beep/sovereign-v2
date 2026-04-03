import { createAgentRoute } from "@/lib/agent-factory";
import { nimChat } from "@/lib/nvidia";

/**
 * COMPETITIVE INTELLIGENCE RADAR
 *
 * Multi-model agent that analyzes a competitor URL and returns:
 * - Tech stack detection (via HTTP headers + HTML analysis)
 * - SEO score estimate (meta tags, structure, speed signals)
 * - Content strategy analysis (topics, frequency, tone)
 * - Vulnerability assessment (gaps you can exploit)
 * - Market positioning map
 *
 * Uses: DeepSeek V3.2 for reasoning, Mistral Nemotron for structured output
 */

export const POST = createAgentRoute({
  name: "competitive-radar",
  requiredFields: ["url"],
  handler: async ({ input }) => {
    const url = input.url as string;

    // Step 1: Fetch target site metadata
    let siteData = "";
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SovereignBot/1.0)" },
        signal: AbortSignal.timeout(8000),
      });
      const html = await res.text();

      // Extract key signals from HTML (first 15KB only)
      const truncated = html.slice(0, 15000);
      const title = truncated.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || "";
      const description = truncated.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)/i)?.[1] || "";
      const h1s = Array.from(truncated.matchAll(/<h1[^>]*>([^<]+)<\/h1>/gi)).map(m => m[1]).slice(0, 5);
      const techSignals: string[] = [];
      if (truncated.includes("next/")) techSignals.push("Next.js");
      if (truncated.includes("react")) techSignals.push("React");
      if (truncated.includes("vue")) techSignals.push("Vue");
      if (truncated.includes("tailwind")) techSignals.push("Tailwind CSS");
      if (truncated.includes("wordpress")) techSignals.push("WordPress");
      if (truncated.includes("shopify")) techSignals.push("Shopify");
      if (truncated.includes("webflow")) techSignals.push("Webflow");
      if (truncated.includes("stripe")) techSignals.push("Stripe");
      if (truncated.includes("intercom")) techSignals.push("Intercom");
      if (truncated.includes("hubspot")) techSignals.push("HubSpot");
      if (truncated.includes("gtag") || truncated.includes("analytics")) techSignals.push("Google Analytics");
      if (truncated.includes("hotjar")) techSignals.push("Hotjar");
      if (truncated.includes("segment")) techSignals.push("Segment");

      const headers = Object.fromEntries(res.headers.entries());
      const server = headers["server"] || "Unknown";
      const poweredBy = headers["x-powered-by"] || "";

      siteData = `URL: ${url}
Title: ${title}
Description: ${description}
H1 headings: ${h1s.join(", ")}
Tech signals in HTML: ${techSignals.join(", ") || "None detected"}
Server: ${server}
X-Powered-By: ${poweredBy}
Status: ${res.status}
Content-Type: ${headers["content-type"] || ""}`;
    } catch {
      siteData = `URL: ${url}\nFailed to fetch — site may block automated requests.`;
    }

    // Step 2: Deep analysis with DeepSeek V3.2
    const analysis = await nimChat(
      "deepseek-ai/deepseek-v3-2-0324",
      [
        {
          role: "system",
          content: `You are a competitive intelligence analyst. Given metadata about a competitor's website, produce a structured analysis. Be specific and actionable. Do NOT pad with generic advice — every point must be based on the actual data provided.

Return JSON only:
{
  "company_name": "detected name",
  "tech_stack": ["list of detected technologies"],
  "seo_score": 0-100,
  "seo_findings": ["specific SEO observations"],
  "content_strategy": {
    "topics": ["main content themes"],
    "tone": "professional/casual/technical/etc",
    "frequency_signal": "high/medium/low/unknown"
  },
  "vulnerabilities": ["specific weaknesses you can exploit"],
  "strengths": ["what they do well"],
  "market_position": "brief positioning statement",
  "recommended_actions": ["3-5 specific counter-moves"]
}`,
        },
        { role: "user", content: siteData },
      ],
      { maxTokens: 1500, temperature: 0.3 }
    );

    // Parse the analysis
    let parsed;
    try {
      const cleaned = analysis.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { raw_analysis: analysis, parse_error: true };
    }

    return {
      target_url: url,
      intelligence: parsed,
      models_used: ["deepseek-v3.2"],
      scan_type: "competitive-radar",
    };
  },
});
