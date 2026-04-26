import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import * as cheerio from "cheerio";
import { createLogger } from "@/lib/logger";
import { safeFetch, SafeFetchError } from "@/lib/safe-fetch";
const log = createLogger("audit-engine");

export const POST = createAgentRoute({
  name: "audit",
  handler: async ({ input }) => {
    const { targetUrl } = input as Record<string, unknown>;

    if (!targetUrl || typeof targetUrl !== "string") {
      return { error: "URL is required" };
    }

    // 1. Physically scrape the target website
    let scrapedText = "";
    try {
      const response = await safeFetch(targetUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SovereignMatrix/1.0",
        },
        timeoutMs: 8000,
      });

      if (response.ok) {
        const html = await response.text();
        const $ = cheerio.load(html);
        // Remove garbage scripts and styles
        $("script, style, nav, footer, iframe").remove();
        scrapedText = $("body")
          .text()
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 15000);
      }
    } catch (e) {
      if (e instanceof SafeFetchError) {
        return { error: e.message };
      }
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
