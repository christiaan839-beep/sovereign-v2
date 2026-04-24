import type { MetadataRoute } from "next";

/**
 * robots.txt emitted by Next's metadata routes.
 *
 * Rules:
 *   - General crawlers allowed on the public site; admin + API blocked.
 *   - AI crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.) explicitly
 *     allowed AND pointed at /llms.txt (the llmstxt.org spec, which
 *     is the LLM-native equivalent of robots.txt + sitemap). This is
 *     how Sovereign Matrix wins AI-search discoverability: by being
 *     one of the few platforms that publishes a structured llms.txt
 *     the moment those crawlers land.
 *   - Sitemap pointer unchanged.
 */
export default function robots(): MetadataRoute.Robots {
  const allowedAgents = [
    "GPTBot",
    "ChatGPT-User",
    "ClaudeBot",
    "anthropic-ai",
    "PerplexityBot",
    "Perplexity-User",
    "Googlebot",
    "Bingbot",
  ];

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard/", "/client-portal/", "/admin/", "/api/"],
      },
      // Explicit welcome for major AI crawlers. They treat these same
      // paths — but an explicit rule block signals intent + avoids
      // overbroad "*" blocks that competitors sometimes apply.
      ...allowedAgents.map((agent) => ({
        userAgent: agent,
        allow: ["/", "/llms.txt", "/spec/", "/marketplace/"],
        disallow: ["/dashboard/", "/client-portal/", "/admin/", "/api/"],
      })),
    ],
    sitemap: [
      "https://sovereignmatrix.agency/sitemap.xml",
    ],
    host: "https://sovereignmatrix.agency",
  };
}
