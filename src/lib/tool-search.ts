/**
 * TOOL SEARCH — Searchable Agent Registry
 *
 * Instead of loading all 140 agent tool schemas into every Claude request
 * (expensive in tokens), this registry lets Claude search for relevant tools
 * by capability. Anthropic's testing showed an 85% reduction in tool-definition
 * tokens using this pattern.
 *
 * Usage:
 *   const tools = searchAgentTools("analyze competitor website")
 *   // Returns only the 2-3 relevant tool schemas, not the whole set
 */

interface AgentToolEntry {
  name: string;
  description: string;
  category: string;
  keywords: string[];
  inputSchema: Record<string, unknown>;
}

/**
 * Lightweight registry of the most-requested agents, with searchable
 * metadata. It holds a curated subset — not all 140 — and searchAgentTools
 * scores only these entries, so an agent absent from this array is never
 * returned by a search. Add an entry here to make an agent discoverable.
 * Each entry stores just enough info to match queries — full schemas
 * are only loaded when a tool is selected.
 */
const AGENT_REGISTRY: AgentToolEntry[] = [
  // ── Content & Writing ──
  { name: "blog-gen", description: "Generate SEO-optimized blog posts on any topic", category: "content", keywords: ["blog", "post", "article", "write", "content", "seo"], inputSchema: { type: "object", properties: { topic: { type: "string" }, tone: { type: "string" }, length: { type: "number" } }, required: ["topic"] } },
  { name: "content", description: "Generate social media captions, email copy, ad copy", category: "content", keywords: ["social", "caption", "email", "copy", "instagram", "linkedin", "twitter"], inputSchema: { type: "object", properties: { type: { type: "string" }, topic: { type: "string" }, platform: { type: "string" } }, required: ["type", "topic"] } },
  { name: "email-sequence", description: "Create multi-step email drip sequences for nurturing", category: "content", keywords: ["email", "sequence", "drip", "nurture", "campaign", "outreach"], inputSchema: { type: "object", properties: { product: { type: "string" }, audience: { type: "string" }, steps: { type: "number" } }, required: ["product"] } },
  { name: "brand-voice", description: "Analyze and enforce brand voice consistency", category: "content", keywords: ["brand", "voice", "tone", "style", "consistency"], inputSchema: { type: "object", properties: { content: { type: "string" }, guidelines: { type: "string" } }, required: ["content"] } },

  // ── Lead Generation & Sales ──
  { name: "leads", description: "Find and qualify B2B leads by industry and location", category: "sales", keywords: ["leads", "prospects", "b2b", "outbound", "find", "qualify", "prospecting"], inputSchema: { type: "object", properties: { niche: { type: "string" }, location: { type: "string" }, count: { type: "number" } }, required: ["niche"] } },
  { name: "closer", description: "Generate sales closing sequences with objection handling", category: "sales", keywords: ["close", "sale", "objection", "deal", "negotiate", "pitch"], inputSchema: { type: "object", properties: { leadName: { type: "string" }, company: { type: "string" }, objections: { type: "string" } }, required: ["leadName"] } },
  { name: "outbound", description: "Automated outbound prospecting and cold outreach", category: "sales", keywords: ["outbound", "cold", "outreach", "prospecting", "email", "campaign"], inputSchema: { type: "object", properties: { target: { type: "string" }, message: { type: "string" } }, required: ["target"] } },

  // ── Competitor Intelligence ──
  { name: "site-assassin", description: "Full website audit — tech stack, SEO, performance, security", category: "intelligence", keywords: ["website", "audit", "analyze", "url", "site", "scan", "tech stack"], inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } },
  { name: "competitor", description: "Deep competitor analysis — pricing, features, positioning", category: "intelligence", keywords: ["competitor", "competition", "analysis", "compare", "versus", "vs"], inputSchema: { type: "object", properties: { companyName: { type: "string" } }, required: ["companyName"] } },
  { name: "competitive-radar", description: "Monitor competitor changes over time", category: "intelligence", keywords: ["monitor", "track", "radar", "competitive", "changes", "alert"], inputSchema: { type: "object", properties: { competitors: { type: "string" } }, required: ["competitors"] } },

  // ── SEO & Search ──
  { name: "seo-dominator", description: "Comprehensive SEO audit with keyword gaps and recommendations", category: "seo", keywords: ["seo", "keyword", "ranking", "search", "optimization", "backlink"], inputSchema: { type: "object", properties: { url: { type: "string" }, keywords: { type: "string" } }, required: ["url"] } },
  { name: "programmatic-seo", description: "Generate hundreds of SEO-optimized pages programmatically", category: "seo", keywords: ["programmatic", "bulk", "pages", "seo", "scale", "automated"], inputSchema: { type: "object", properties: { template: { type: "string" }, keywords: { type: "string" } }, required: ["template"] } },

  // ── Code & Development ──
  { name: "code-agent", description: "Write production code in any language", category: "code", keywords: ["code", "programming", "develop", "implement", "function", "build"], inputSchema: { type: "object", properties: { objective: { type: "string" }, language: { type: "string" } }, required: ["objective"] } },
  { name: "code-reviewer", description: "Review code for bugs, security, and best practices", category: "code", keywords: ["review", "bugs", "security", "quality", "lint", "check"], inputSchema: { type: "object", properties: { code: { type: "string" }, language: { type: "string" } }, required: ["code"] } },

  // ── Voice & Audio ──
  { name: "voice-synth", description: "Text-to-speech synthesis with natural voice", category: "voice", keywords: ["voice", "speech", "tts", "audio", "speak", "synthesize", "narrate"], inputSchema: { type: "object", properties: { text: { type: "string" }, voice: { type: "string" } }, required: ["text"] } },
  { name: "voice-assistant", description: "Conversational voice AI assistant", category: "voice", keywords: ["voice", "assistant", "talk", "conversation", "call", "phone"], inputSchema: { type: "object", properties: { message: { type: "string" } }, required: ["message"] } },
  { name: "asr", description: "Automatic speech recognition — transcribe audio to text", category: "voice", keywords: ["transcribe", "speech", "audio", "whisper", "recording", "dictation"], inputSchema: { type: "object", properties: { audio: { type: "string" } }, required: ["audio"] } },

  // ── Research & Analysis ──
  { name: "omni-search", description: "Search across web, docs, and databases simultaneously", category: "research", keywords: ["search", "find", "research", "query", "lookup", "information"], inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "grounded-search", description: "Factual web search with citations and source verification", category: "research", keywords: ["search", "factual", "citation", "source", "verify", "grounded"], inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "doc-intel", description: "Analyze documents — extract data, answer questions, summarize", category: "research", keywords: ["document", "pdf", "analyze", "extract", "summarize", "contract"], inputSchema: { type: "object", properties: { document: { type: "string" }, question: { type: "string" } }, required: ["document"] } },

  // ── Image & Visual ──
  { name: "flux-image", description: "Generate images with FLUX.1 model", category: "visual", keywords: ["image", "generate", "picture", "photo", "illustration", "art", "flux"], inputSchema: { type: "object", properties: { prompt: { type: "string" }, size: { type: "string" } }, required: ["prompt"] } },
  { name: "vision", description: "Analyze images — describe, OCR, object detection", category: "visual", keywords: ["vision", "image", "analyze", "ocr", "detect", "describe", "screenshot"], inputSchema: { type: "object", properties: { imageUrl: { type: "string" }, question: { type: "string" } }, required: ["imageUrl"] } },

  // ── Orchestration & Meta ──
  { name: "smart-router", description: "Automatically route tasks to the best model and agent", category: "meta", keywords: ["route", "auto", "best", "model", "select", "optimal"], inputSchema: { type: "object", properties: { prompt: { type: "string" }, task: { type: "string" } }, required: ["prompt"] } },
  { name: "god-brain", description: "Multi-model pipeline — safety, analysis, reasoning, synthesis", category: "meta", keywords: ["god", "brain", "pipeline", "multi-model", "deep", "complex", "meta"], inputSchema: { type: "object", properties: { objective: { type: "string" } }, required: ["objective"] } },
  { name: "agentic-chain", description: "Chain multiple agents together for complex workflows", category: "meta", keywords: ["chain", "workflow", "pipeline", "multi-agent", "sequence", "orchestrate"], inputSchema: { type: "object", properties: { steps: { type: "string" } }, required: ["steps"] } },

  // ── Browser Automation ──
  { name: "computer-use", description: "Control a virtual browser — click, type, screenshot, navigate", category: "automation", keywords: ["browser", "click", "navigate", "screenshot", "automation", "web", "scrape"], inputSchema: { type: "object", properties: { objective: { type: "string" }, url: { type: "string" } }, required: ["objective"] } },
  { name: "firecrawl", description: "Crawl and scrape websites for structured data extraction", category: "automation", keywords: ["crawl", "scrape", "extract", "data", "website", "spider"], inputSchema: { type: "object", properties: { url: { type: "string" }, selectors: { type: "string" } }, required: ["url"] } },
];

/**
 * Search the agent registry by natural language query.
 * Uses keyword matching with relevance scoring.
 * Returns the top N most relevant agent tool definitions.
 */
export function searchAgentTools(query: string, limit: number = 5): AgentToolEntry[] {
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2);

  const scored = AGENT_REGISTRY.map(entry => {
    let score = 0;

    // Exact name match = highest score
    if (queryLower.includes(entry.name)) score += 10;

    // Keyword matches
    for (const keyword of entry.keywords) {
      if (queryLower.includes(keyword)) score += 3;
      for (const term of queryTerms) {
        if (keyword.includes(term) || term.includes(keyword)) score += 1;
      }
    }

    // Category match
    for (const term of queryTerms) {
      if (entry.category.includes(term)) score += 2;
    }

    // Description match
    for (const term of queryTerms) {
      if (entry.description.toLowerCase().includes(term)) score += 1;
    }

    return { entry, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.entry);
}

/**
 * Get the full tool schema for a specific agent by name.
 */
export function getAgentTool(name: string): AgentToolEntry | undefined {
  return AGENT_REGISTRY.find(entry => entry.name === name);
}

/**
 * Returns all agent names grouped by category.
 */
export function getAgentCategories(): Record<string, string[]> {
  const categories: Record<string, string[]> = {};
  for (const entry of AGENT_REGISTRY) {
    if (!categories[entry.category]) categories[entry.category] = [];
    categories[entry.category].push(entry.name);
  }
  return categories;
}

/**
 * Returns the full registry size for metrics.
 */
export function getRegistrySize(): number {
  return AGENT_REGISTRY.length;
}
