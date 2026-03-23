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
  params: Record<string, string>;
  confidence: number;
  label: string;
}

const ROUTES: Array<{
  keywords: string[];
  endpoint: string;
  label: string;
  extractParam?: (text: string) => Record<string, string>;
}> = [
  {
    keywords: ["audit", "scan website", "vulnerability", "security scan"],
    endpoint: "/api/agents/audit",
    label: "Website Audit",
    extractParam: (t) => ({ url: extractUrl(t) || t }),
  },
  {
    keywords: ["blog", "article", "write about", "write a post"],
    endpoint: "/api/agents/blog-gen",
    label: "Blog Generator",
    extractParam: (t) => ({ topic: stripKeywords(t, ["write", "blog", "article", "about", "post", "a"]) }),
  },
  {
    keywords: ["translate", "translation", "spanish", "french", "german", "japanese", "korean", "arabic"],
    endpoint: "/api/agents/translate",
    label: "Translator",
    extractParam: (t) => {
      const langMap: Record<string, string> = { spanish: "es", french: "fr", german: "de", japanese: "ja", korean: "ko", arabic: "ar", italian: "it", portuguese: "pt", chinese: "zh", russian: "ru", hindi: "hi" };
      const lang = Object.keys(langMap).find(l => t.toLowerCase().includes(l));
      return { text: stripKeywords(t, ["translate", "to", "into", "in", ...(lang ? [lang] : [])]), target_lang: lang ? langMap[lang] : "es" };
    },
  },
  {
    keywords: ["leads", "prospects", "find companies", "b2b", "prospecting"],
    endpoint: "/api/agents/leads",
    label: "Lead Prospector",
    extractParam: (t) => ({ prompt: stripKeywords(t, ["find", "leads", "prospects", "for"]) }),
  },
  {
    keywords: ["image", "generate image", "picture", "logo", "illustration", "draw"],
    endpoint: "/api/agents/flux-image",
    label: "Image Generator",
    extractParam: (t) => ({ prompt: stripKeywords(t, ["generate", "create", "make", "image", "picture", "of", "a", "an"]) }),
  },
  {
    keywords: ["competitor", "compete", "rival", "competition"],
    endpoint: "/api/agents/competitor-scan",
    label: "Competitor Scanner",
    extractParam: (t) => ({ url: extractUrl(t) || stripKeywords(t, ["scan", "competitor", "analyze"]) }),
  },
  {
    keywords: ["page", "landing page", "website", "build a site", "html"],
    endpoint: "/api/agents/page-builder",
    label: "Page Builder",
    extractParam: (t) => ({ prompt: stripKeywords(t, ["build", "create", "make", "page", "landing", "website", "a"]) }),
  },
  {
    keywords: ["email", "outreach", "cold email", "sequence"],
    endpoint: "/api/agents/outbound",
    label: "Email Outreach",
    extractParam: (t) => ({ prompt: t }),
  },
  {
    keywords: ["code", "review code", "debug", "fix bug", "refactor"],
    endpoint: "/api/agents/code-reviewer",
    label: "Code Reviewer",
    extractParam: (t) => ({ code: stripKeywords(t, ["review", "code", "debug", "fix"]), language: "typescript" }),
  },
  {
    keywords: ["seo", "keywords", "search engine", "ranking"],
    endpoint: "/api/agents/seo-dominator",
    label: "SEO Analyzer",
    extractParam: (t) => ({ url: extractUrl(t) || t, task: "xray" }),
  },
  {
    keywords: ["content", "social media", "post", "caption", "tweet"],
    endpoint: "/api/agents/social-router",
    label: "Social Content",
    extractParam: (t) => ({ prompt: t, platforms: ["linkedin", "twitter"] }),
  },
  {
    keywords: ["ocr", "extract text", "read document", "scan document"],
    endpoint: "/api/agents/ocr",
    label: "Document OCR",
    extractParam: (t) => ({ prompt: t }),
  },
  {
    keywords: ["pii", "redact", "privacy", "personal data"],
    endpoint: "/api/agents/pii-guard",
    label: "PII Detector",
    extractParam: (t) => ({ text: stripKeywords(t, ["check", "scan", "detect", "pii", "for"]) }),
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
