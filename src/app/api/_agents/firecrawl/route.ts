import { createAgentRoute } from "@/lib/agent-factory";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * FIRECRAWL AGENT — Open-Source Web Scraper
 * Uses the Firecrawl API to turn any website into LLM-ready markdown.
 * Bypasses anti-bot protections natively.
 */
import { outboundFetchAsResponse } from "@/lib/outbound-fetch";

export const POST = createAgentRoute({
  name: "firecrawl",
  handler: async ({ input, email, userId }) => {
    const { url, formats = ["markdown"] } = input as Record<string, unknown>;

    if (!url) {
      return { error: "Target URL is required." };
    }

    // Attempt to pull user's Firecrawl key if available
    let apiKey = process.env.FIRECRAWL_API_KEY || "";
    if (email) {
      try {
        const userSettings = await db.query.settings.findFirst({
          where: eq(settings.userEmail, email),
        });
        if (userSettings?.apiKeys) {
          const keys = JSON.parse(userSettings.apiKeys);
          if (keys.firecrawl) apiKey = keys.firecrawl;
        }
      } catch {
        /* BYOK lookup failed */
      }
    }

    if (!apiKey) {
      return { error: "Firecrawl API key required." };
    }

    // Call Firecrawl Scrape API
    const response = await outboundFetchAsResponse("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats,
      }),
    }, { ruleId: "agents.firecrawl.route.1", allowedHosts: ["api.firecrawl.dev"] });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        {
          error: `Firecrawl request failed: ${response.status}`,
          details: errorText,
        },
        { status: response.status },
      );
    }

    const data = await response.json();

    return {
      success: true,
      url: data.data?.metadata?.sourceURL || url,
      markdown: data.data?.markdown || "",
      title: data.data?.metadata?.title || "Unknown Page",
      status: "Extracted via Open-Source Node",
    };
  },
});
