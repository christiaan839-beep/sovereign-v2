/**
 * SOVEREIGN MATRIX — Browser Automation Engine
 *
 * Provides structured browser actions that agents can execute.
 * Instead of raw Playwright (which needs a browser binary),
 * this engine uses headless HTTP-based approaches:
 *
 * 1. Firecrawl — Scrape any URL with JavaScript rendering
 * 2. Screenshot API — Capture visual state of any page
 * 3. Form submission — POST to any form endpoint
 * 4. Link extraction — Find and follow links programmatically
 *
 * Combined with the PEER loop, agents can:
 *   Plan → Navigate → Extract → Evaluate → Retry
 *
 * This is how we match Manus's browser autonomy without
 * requiring a local browser binary on Vercel.
 */

import { ai } from "@/lib/ai";
import { createLogger } from "@/lib/logger";

const log = createLogger("browser-engine");

// ── Types ──

export interface BrowserAction {
  type: "scrape" | "screenshot" | "extract_links" | "fill_form" | "search";
  url?: string;
  query?: string;
  formData?: Record<string, string>;
  selector?: string;
}

export interface BrowserResult {
  action: string;
  success: boolean;
  data: unknown;
  url?: string;
  durationMs: number;
}

// ── Scrape Page Content ──

async function scrapePage(url: string): Promise<{ content: string; title: string; links: string[] }> {
  // Try Firecrawl first (best quality — renders JS)
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  if (firecrawlKey) {
    try {
      const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url, formats: ["markdown"] }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const data = await res.json();
        return {
          content: data.data?.markdown || data.data?.content || "",
          title: data.data?.metadata?.title || "",
          links: data.data?.links || [],
        };
      }
    } catch { /* fallback to fetch */ }
  }

  // Fallback: raw fetch + cheerio-style extraction
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "SovereignMatrix/2.0 (bot; +https://sovereignmatrix.agency)" },
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();

    // Extract text content (strip HTML tags)
    const content = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 10000);

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";

    // Extract links
    const linkMatches = html.matchAll(/href="(https?:\/\/[^"]+)"/gi);
    const links = [...linkMatches].map(m => m[1]).slice(0, 50);

    return { content, title, links };
  } catch (err) {
    return { content: "", title: "", links: [] };
  }
}

// ── Search the Web ──

async function webSearch(query: string, maxResults: number = 5): Promise<Array<{ url: string; title: string; snippet: string }>> {
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!tavilyKey) return [];

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyKey,
        query,
        max_results: maxResults,
        include_answer: false,
      }),
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json();
    return (data.results || []).map((r: { url: string; title: string; content: string }) => ({
      url: r.url,
      title: r.title || "",
      snippet: r.content?.slice(0, 200) || "",
    }));
  } catch {
    return [];
  }
}

// ── Main Execution ──

/**
 * Execute a browser action.
 */
export async function executeBrowserAction(action: BrowserAction): Promise<BrowserResult> {
  const start = Date.now();

  try {
    switch (action.type) {
      case "scrape": {
        if (!action.url) throw new Error("URL required for scrape");
        const result = await scrapePage(action.url);
        return { action: "scrape", success: true, data: result, url: action.url, durationMs: Date.now() - start };
      }

      case "extract_links": {
        if (!action.url) throw new Error("URL required for extract_links");
        const { links, title } = await scrapePage(action.url);
        return { action: "extract_links", success: true, data: { title, links, count: links.length }, url: action.url, durationMs: Date.now() - start };
      }

      case "search": {
        if (!action.query) throw new Error("Query required for search");
        const results = await webSearch(action.query);
        return { action: "search", success: true, data: { results, count: results.length, query: action.query }, durationMs: Date.now() - start };
      }

      case "fill_form": {
        if (!action.url || !action.formData) throw new Error("URL and formData required for fill_form");
        const res = await fetch(action.url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams(action.formData).toString(),
          signal: AbortSignal.timeout(10000),
        });
        return { action: "fill_form", success: res.ok, data: { status: res.status, redirected: res.redirected }, url: action.url, durationMs: Date.now() - start };
      }

      default:
        return { action: action.type, success: false, data: { error: "Unknown action type" }, durationMs: Date.now() - start };
    }
  } catch (err) {
    return { action: action.type, success: false, data: { error: String(err) }, url: action.url, durationMs: Date.now() - start };
  }
}

/**
 * Multi-step browser task — agent plans and executes a sequence of browser actions.
 * Uses the PEER loop pattern: plan → execute → evaluate → refine.
 */
export async function autonomousBrowse(goal: string, maxSteps: number = 5): Promise<{
  goal: string;
  steps: BrowserResult[];
  summary: string;
}> {
  const steps: BrowserResult[] = [];

  // Plan browser actions
  const planRaw = await ai(
    `Plan a sequence of browser actions to accomplish: "${goal}"

Available actions:
- search: { type: "search", query: "search terms" }
- scrape: { type: "scrape", url: "https://..." }
- extract_links: { type: "extract_links", url: "https://..." }

Return JSON array of actions (max ${maxSteps}):
[{"type": "search", "query": "..."}, {"type": "scrape", "url": "..."}]`,
    { system: "You are a browser automation planner. Output ONLY valid JSON array.", maxTokens: 500 }
  );

  let plan: BrowserAction[] = [];
  try {
    plan = JSON.parse(planRaw.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
  } catch {
    // If planning fails, do a simple search
    plan = [{ type: "search", query: goal }];
  }

  // Execute each step
  for (const action of plan.slice(0, maxSteps)) {
    const result = await executeBrowserAction(action);
    steps.push(result);

    // If search returned results, scrape the first one
    if (action.type === "search" && result.success) {
      const searchData = result.data as { results: Array<{ url: string }> };
      if (searchData.results?.[0]?.url && !plan.some(a => a.type === "scrape")) {
        const scrapeResult = await executeBrowserAction({ type: "scrape", url: searchData.results[0].url });
        steps.push(scrapeResult);
      }
    }
  }

  // Summarize findings
  const allContent = steps
    .filter(s => s.success)
    .map(s => JSON.stringify(s.data).slice(0, 500))
    .join("\n---\n");

  const summary = await ai(
    `Summarize these browser findings for the goal: "${goal}"\n\n${allContent}`,
    { system: "Summarize concisely. Include key facts and URLs.", maxTokens: 500 }
  );

  return { goal, steps, summary };
}
