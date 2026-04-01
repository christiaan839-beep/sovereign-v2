/**
 * SOVEREIGN MATRIX — Intent Router
 *
 * Maps natural language queries to the correct agent endpoint.
 * Fast path: keyword matching (~0ms).
 * Slow path: NIM classification for ambiguous queries.
 *
 * Usage:
 *   import { routeIntent } from "@/lib/intent-router";
 *   const { endpoint, params, confidence } = routeIntent("audit example.com");
 */

export interface IntentResult {
  endpoint: string;
  params: Record<string, unknown>;
  confidence: number;
  label: string;
}

const ROUTES: Array<{
  keywords: string[];
  endpoint: string;
  label: string;
  extractParam?: (text: string) => Record<string, unknown>;
}> = [
  {
    keywords: ["audit", "scan website", "vulnerability", "security scan"],
    endpoint: "/api/_agents/audit",
    label: "Website Audit",
    extractParam: (t) => ({ url: extractUrl(t) || t }),
  },
  {
    keywords: ["blog", "article", "write about", "write a post"],
    endpoint: "/api/_agents/blog-gen",
    label: "Blog Generator",
    extractParam: (t) => ({ topic: stripKeywords(t, ["write", "blog", "article", "about", "post", "a"]) }),
  },
  {
    keywords: ["translate", "translation", "spanish", "french", "german", "japanese", "korean", "arabic"],
    endpoint: "/api/_agents/translate",
    label: "Translator",
    extractParam: (t) => {
      const langMap: Record<string, string> = { spanish: "es", french: "fr", german: "de", japanese: "ja", korean: "ko", arabic: "ar", italian: "it", portuguese: "pt", chinese: "zh", russian: "ru", hindi: "hi" };
      const lang = Object.keys(langMap).find(l => t.toLowerCase().includes(l));
      return { text: stripKeywords(t, ["translate", "to", "into", "in", ...(lang ? [lang] : [])]), target_lang: lang ? langMap[lang] : "es" };
    },
  },
  {
    keywords: ["leads", "prospects", "find companies", "b2b", "prospecting"],
    endpoint: "/api/_agents/leads",
    label: "Lead Prospector",
    extractParam: (t) => ({ prompt: stripKeywords(t, ["find", "leads", "prospects", "for"]) }),
  },
  {
    keywords: ["image", "generate image", "picture", "logo", "illustration", "draw"],
    endpoint: "/api/_agents/flux-image",
    label: "Image Generator",
    extractParam: (t) => ({ prompt: stripKeywords(t, ["generate", "create", "make", "image", "picture", "of", "a", "an"]) }),
  },
  {
    keywords: ["competitor", "compete", "rival", "competition"],
    endpoint: "/api/_agents/competitor-scan",
    label: "Competitor Scanner",
    extractParam: (t) => ({ url: extractUrl(t) || stripKeywords(t, ["scan", "competitor", "analyze"]) }),
  },
  {
    keywords: ["page", "landing page", "website", "build a site", "html"],
    endpoint: "/api/_agents/page-builder",
    label: "Page Builder",
    extractParam: (t) => ({ prompt: stripKeywords(t, ["build", "create", "make", "page", "landing", "website", "a"]) }),
  },
  {
    keywords: ["email", "outreach", "cold email", "sequence"],
    endpoint: "/api/_agents/outbound",
    label: "Email Outreach",
    extractParam: (t) => ({ prompt: t }),
  },
  {
    keywords: ["code", "review code", "debug", "fix bug", "refactor"],
    endpoint: "/api/_agents/code-reviewer",
    label: "Code Reviewer",
    extractParam: (t) => ({ code: stripKeywords(t, ["review", "code", "debug", "fix"]), language: "typescript" }),
  },
  {
    keywords: ["seo", "keywords", "search engine", "ranking"],
    endpoint: "/api/_agents/seo-dominator",
    label: "SEO Analyzer",
    extractParam: (t) => ({ url: extractUrl(t) || t, task: "xray" }),
  },
  {
    keywords: ["content", "social media", "post", "caption", "tweet"],
    endpoint: "/api/_agents/social-router",
    label: "Social Content",
    extractParam: (t) => ({ prompt: t, platforms: ["linkedin", "twitter"] }),
  },
  {
    keywords: ["ocr", "extract text", "read document", "scan document"],
    endpoint: "/api/_agents/ocr",
    label: "Document OCR",
    extractParam: (t) => ({ prompt: t }),
  },
  {
    keywords: ["pii", "redact", "privacy", "personal data"],
    endpoint: "/api/_agents/pii-guard",
    label: "PII Detector",
    extractParam: (t) => ({ text: stripKeywords(t, ["check", "scan", "detect", "pii", "for"]) }),
  },
  {
    keywords: ["research", "search for", "find out", "latest", "current", "news about"],
    endpoint: "/api/_agents/grounded-search",
    label: "Grounded Search",
    extractParam: (t) => ({ query: stripKeywords(t, ["research", "search", "find", "out", "for"]) }),
  },
  {
    keywords: ["think deeply", "analyze strategy", "solve this", "plan for", "figure out"],
    endpoint: "/api/_agents/deep-think",
    label: "Deep Think",
    extractParam: (t) => ({ problem: t }),
  },
  {
    keywords: ["automate", "autonomous", "multi-step", "agent chain", "do everything"],
    endpoint: "/api/_agents/agentic-chain",
    label: "Agentic Chain",
    extractParam: (t) => ({ goal: t }),
  },
  {
    keywords: ["analyze url", "read this page", "check this site", "look at this url"],
    endpoint: "/api/_agents/url-context",
    label: "URL Analyzer",
    extractParam: (t) => ({ url: extractUrl(t) || t, question: "Analyze this page comprehensively." }),
  },
  {
    keywords: ["run code", "execute", "calculate", "python", "script", "compute"],
    endpoint: "/api/_agents/code-sandbox",
    label: "Code Sandbox",
    extractParam: (t) => ({ task: t }),
  },
  {
    keywords: ["workflow", "automation", "pipeline", "chain agents", "sequence"],
    endpoint: "/api/_agents/workflow-engine",
    label: "Workflow Engine",
    extractParam: (t) => ({ workflow: { nodes: [], edges: [] }, description: t }),
  },
  {
    keywords: ["analyze image", "screenshot", "what is this image", "read this photo"],
    endpoint: "/api/_agents/vision-analyze",
    label: "Vision Analyzer",
    extractParam: (t) => ({ imageUrl: extractUrl(t) || "", question: t }),
  },
  {
    keywords: ["think hard", "reason through", "complex problem", "extended thinking", "chain of thought"],
    endpoint: "/api/_agents/claude-think",
    label: "Claude Extended Thinking",
    extractParam: (t) => ({ problem: t }),
  },
  {
    keywords: ["generate photo", "photorealistic", "imagen", "high quality image"],
    endpoint: "/api/_agents/imagen",
    label: "Imagen 3",
    extractParam: (t) => ({ prompt: stripKeywords(t, ["generate", "create", "photo", "photorealistic", "imagen"]) }),
  },
  {
    keywords: ["enterprise search", "find sources", "cited research", "grounded answer"],
    endpoint: "/api/_agents/vertex-search",
    label: "Enterprise Search",
    extractParam: (t) => ({ query: t }),
  },
  {
    keywords: ["talk to", "speak", "voice", "listen", "omni", "multimodal"],
    endpoint: "/api/_agents/nemotron-omni",
    label: "Sovereign Voice",
    extractParam: (t) => ({ prompt: t, mode: "text" }),
  },
];

/**
 * Route a natural language query to the correct agent.
 * Returns endpoint, extracted parameters, confidence score, and label.
 */
export function routeIntent(query: string): IntentResult {
  const lower = query.toLowerCase().trim();

  // Fast path: keyword matching
  for (const route of ROUTES) {
    for (const keyword of route.keywords) {
      if (lower.includes(keyword)) {
        const params = route.extractParam ? route.extractParam(query) : { prompt: query };
        return {
          endpoint: route.endpoint,
          params,
          confidence: 0.9,
          label: route.label,
        };
      }
    }
  }

  // No match — fallback to general chat
  return {
    endpoint: "/api/ai/stream",
    params: { prompt: query, model: "nimchat" },
    confidence: 0.5,
    label: "General Assistant",
  };
}

// ─── Helpers ───

function extractUrl(text: string): string {
  const match = text.match(/https?:\/\/[^\s]+|(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*/);
  return match ? (match[0].startsWith("http") ? match[0] : `https://${match[0]}`) : "";
}

function stripKeywords(text: string, keywords: string[]): string {
  let result = text;
  for (const kw of keywords) {
    result = result.replace(new RegExp(`\\b${kw}\\b`, "gi"), "");
  }
  return result.replace(/\s+/g, " ").trim();
}
