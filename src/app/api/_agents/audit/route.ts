import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import * as cheerio from "cheerio";
import { createLogger } from "@/lib/logger";
import { outboundFetch, BOT_USER_AGENT } from "@/lib/outbound-fetch";
const log = createLogger("audit-engine");

export const POST = createAgentRoute({
  name: "audit",
  handler: async ({ input, email, userId }) => {
    const { targetUrl } = input as Record<string, unknown>;

    if (!targetUrl) {
      return { error: "URL is required" };
    }

    // 1. Physically scrape the target website
    let scrapedText = "";
    try {
      const response = await outboundFetch(
        targetUrl as string,
        {
          method: "GET",
          headers: { "User-Agent": BOT_USER_AGENT },
        },
        {
          ruleId: "audit.fetch_target",
          userId: userId ?? "anon",
          maxResponseBytes: 200_000,
          timeoutMs: 8_000,
        }
      );

      if (response.ok) {
        const html = response.body;
        const $ = cheerio.load(html);
        // Remove garbage scripts and styles
        $("script, style, nav, footer, iframe").remove();
        scrapedText = $("body")
          .text()
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 15000);
      }
    } catch {
      log.warn(
        "Scraping firewall hit. Synthesizing based on domain heuristics.",
      );
    }

    // 2. Feed into Google AI Ultra (Gemini 1.5 Pro)
    const { object } = await generateObject({
      model: google("gemini-1.5-pro"),
      schema: z.object({
        companyName: z.string(),
        criticalFlaws: z
          .array(z.string())
          .describe(
            "Maximum 3 brutal, high-level business logic flaws regarding human labor or generic SaaS.",
          ),
        costInefficiency: z
          .string()
          .describe(
            "An estimated dollar amount formatting, e.g. '$24,000/mo burned on human execution'",
          ),
        aiReplacementStrategy: z
          .string()
          .describe("What Sovereign Matrix node replaces their entire model."),
      }),
      system: `You are the Sovereign Matrix God-Brain. You generate brutal, defense-contractor style Threat Assessments against competitor B2B agencies. Analyze this scraped website text and output a high-ticket audit designed to convince their clients to switch to an autonomous AI sovereign node.`,
      prompt: `Target URL: ${targetUrl}\n\nScraped Intel:\n${scrapedText || "Firewalled. Infer business model from domain name."}`,
    });

    return {
      ...object,
      pdfReady: true,
    };
  },
});
