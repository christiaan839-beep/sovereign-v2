import { createAgentRoute } from "@/lib/agent-factory";
import { nimChat } from "@/lib/nvidia";
import { research_ai } from "@/lib/ai";

/**
 * NEMOCLAW SITE ASSASSIN — Scrape any URL, reverse-engineer it,
 * identify UX weaknesses, and generate a superior page.
 * Uses Tavily for live scraping + Devstral 2 123B for code generation.
 */

export const POST = createAgentRoute({
  name: "site-assassin",
  // Wave-111.1 batch 8: memory hooks. Per-URL audit history compounds —
  // last quarter's UX score + weaknesses + conversion killers inform
  // this scan, surface what's been fixed vs what's still broken.
  memory: {
    search: {
      query: (input) =>
        `site-assassin url:${input.url ?? ""} mode:${input.mode ?? "analyze"}`,
      limit: 2,
    },
    store: {
      extract: (result, input) => {
        if (input.mode === "clone-superior") return null; // generated HTML, not insight
        const r = result as {
          target?: string;
          audit?: {
            ux_score?: number;
            weaknesses?: Array<{ issue?: string; severity?: string }>;
            overall_verdict?: string;
          };
        };
        const a = r.audit;
        if (!a) return null;
        const topWeaknesses = (a.weaknesses ?? [])
          .slice(0, 3)
          .map((w) => `[${w.severity ?? "?"}] ${w.issue ?? ""}`)
          .join(" | ");
        return `${r.target ?? ""} (UX ${a.ux_score ?? "?"}): ${topWeaknesses}. ${a.overall_verdict ?? ""}`;
      },
      metadata: (input) => ({
        url: String(input.url ?? ""),
        kind: "site-assassin-audit",
      }),
    },
  },
  handler: async ({ input, email, userId, pastContextAsPrompt }) => {
    const { url, mode = "analyze" } = input as Record<string, unknown>;

    if (!url) {
      return { error: "url is required." };
    }

    const start = Date.now();

    // Step 1: Scrape the target via Tavily
    let siteIntel = "";
    try {
      siteIntel = await research_ai(
        `${url} website design UX analysis`,
        `Analyze the website at ${url}. Describe in detail: the page layout, navigation structure, color scheme, typography, call-to-action placement, loading experience, mobile responsiveness, and content hierarchy. Note any UX anti-patterns, broken elements, or conversion killers.`,
      );
    } catch {
      siteIntel = `Unable to scrape ${url}. Falling back to domain-level analysis.`;
    }

    if (mode === "analyze") {
      const pastAudits = pastContextAsPrompt();
      // Pure analysis: identify weaknesses
      const analysis = await nimChat(
        "nvidia/llama-3.1-nemotron-ultra-253b-v1",
        [
          {
            role: "system",
            content:
              "You are a strategic UX auditor and conversion rate optimizer. Identify every weakness and score the site.",
          },
          {
            role: "user",
            content: `Analyze this competitor website and provide a brutal UX audit.\n\nTARGET: ${url}\nINTEL:\n${siteIntel}${pastAudits ? `\n\nPRIOR AUDITS on this URL (historical FACTS — surface what's been fixed vs still broken, do NOT restate prior findings):\n${pastAudits}` : ""}\n\nOutput JSON:\n{"ux_score": 0-100, "weaknesses": [{"issue": "description", "severity": "CRITICAL|HIGH|MEDIUM|LOW", "fix": "how to exploit this"}], "conversion_killers": ["list"], "speed_estimate": "fast|medium|slow", "mobile_score": 0-100, "overall_verdict": "one sentence"}`,
          },
        ],
        { maxTokens: 2000, temperature: 0.3 },
      );

      let parsed;
      try {
        parsed = JSON.parse(
          analysis
            .replace(/```json?\n?/g, "")
            .replace(/```/g, "")
            .trim(),
        );
      } catch {
        parsed = { raw: analysis };
      }

      return {
        success: true,
        agent: "nemoclaw-site-assassin",
        mode: "analyze",
        target: url,
        audit: parsed,
        duration_ms: Date.now() - start,
      };
    }

    if (mode === "clone-superior") {
      // Generate a BETTER version of their page
      const superiorPage = await nimChat(
        "nvidia/devstral-2-123b-instruct-2512",
        [
          {
            role: "system",
            content:
              "You are a web developer. Generate a complete, production-ready HTML page that is BETTER than the competitor's site. Use modern CSS, smooth animations, and superior conversion elements. Return ONLY valid HTML.",
          },
          {
            role: "user",
            content: `Based on this competitor analysis, generate a SUPERIOR landing page.\n\nCOMPETITOR: ${url}\nINTEL:\n${siteIntel}\n\nRequirements:\n- Dark, premium aesthetic\n- Faster-loading structure\n- Better CTA placement\n- Mobile-first responsive\n- Include social proof section\n- Add urgency elements\n\nReturn complete HTML with inline CSS.`,
          },
        ],
        { maxTokens: 4000, temperature: 0.4 },
      );

      return {
        success: true,
        agent: "nemoclaw-site-assassin",
        mode: "clone-superior",
        target: url,
        generated_html: superiorPage,
        duration_ms: Date.now() - start,
      };
    }

    return { error: "mode must be 'analyze' or 'clone-superior'." };
  },
});
