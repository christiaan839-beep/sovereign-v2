/**
 * SOVEREIGN MATRIX — Agent Blueprints & Cookbooks
 *
 * Blueprints are pre-built agent configurations (single agent).
 * Cookbooks are multi-agent workflow templates (agent pipelines).
 *
 * Users can:
 * 1. Deploy a blueprint with one click
 * 2. Run a cookbook (multi-step agent pipeline)
 * 3. Create and share custom blueprints
 * 4. Fork community blueprints and customize
 */

// ─── Types ───────────────────────────────────────────

export interface AgentBlueprint {
  id: string;
  name: string;
  description: string;
  category: BlueprintCategory;
  icon: string;
  /** The agent endpoint to call */
  agentEndpoint: string;
  /** Default input fields */
  defaultInputs: Record<string, string>;
  /** System prompt override (optional) */
  systemPrompt?: string;
  /** Which model to prefer */
  preferredModel?: string;
  /** Guardrail policies */
  guardrails?: string[];
  /** Tags for search/filter */
  tags: string[];
  /** Author */
  author: string;
  /** Usage count */
  installs: number;
}

export interface Cookbook {
  id: string;
  name: string;
  description: string;
  category: BlueprintCategory;
  icon: string;
  /** Ordered list of steps */
  steps: CookbookStep[];
  /** Tags */
  tags: string[];
  /** Author */
  author: string;
  /** Estimated execution time */
  estimatedTime: string;
}

export interface CookbookStep {
  name: string;
  agentEndpoint: string;
  inputs: Record<string, string>;
  /** Map output fields from this step to the next step's input */
  outputMapping?: Record<string, string>;
  /** Wait for manual approval before proceeding */
  requireApproval?: boolean;
}

export type BlueprintCategory =
  | "sales"
  | "content"
  | "seo"
  | "voice"
  | "code"
  | "security"
  | "research"
  | "automation"
  | "creative";

// ─── Built-in Blueprints ─────────────────────────────

export const BLUEPRINTS: AgentBlueprint[] = [
  {
    id: "bp-lead-hunter",
    name: "Lead Hunter",
    description: "Find and enrich B2B prospects in any niche with verified emails",
    category: "sales",
    icon: "🎯",
    agentEndpoint: "/api/agents/leads",
    defaultInputs: { action: "prospect", "params.niche": "", "params.location": "" },
    preferredModel: "gemini",
    guardrails: ["no-pii-leakage"],
    tags: ["leads", "prospecting", "b2b", "email"],
    author: "Sovereign Matrix",
    installs: 2847,
  },
  {
    id: "bp-seo-xray",
    name: "SEO X-Ray",
    description: "Analyze any website for keyword gaps, tech stack, and counter-moves",
    category: "seo",
    icon: "🔍",
    agentEndpoint: "/api/agents/site-assassin",
    defaultInputs: { url: "" },
    preferredModel: "nemotron",
    tags: ["seo", "competitor", "keywords", "audit"],
    author: "Sovereign Matrix",
    installs: 1923,
  },
  {
    id: "bp-blog-writer",
    name: "1500-Word Blog Generator",
    description: "Research a topic, write SEO-optimized blog post, anti-AI detection",
    category: "content",
    icon: "✍️",
    agentEndpoint: "/api/agents/blog-gen",
    defaultInputs: { topic: "", keywords: "", tone: "professional" },
    preferredModel: "deepseek",
    guardrails: ["topic-lock"],
    tags: ["blog", "seo", "content", "writing"],
    author: "Sovereign Matrix",
    installs: 3451,
  },
  {
    id: "bp-cold-caller",
    name: "AI Cold Caller",
    description: "Autonomous voice agent that qualifies leads and books meetings",
    category: "voice",
    icon: "📞",
    agentEndpoint: "/api/agents/voice-closer",
    defaultInputs: {},
    preferredModel: "auto",
    guardrails: ["no-pii-leakage", "rate-limit-enforce"],
    tags: ["voice", "calls", "sales", "booking"],
    author: "Sovereign Matrix",
    installs: 892,
  },
  {
    id: "bp-page-builder",
    name: "Landing Page Generator",
    description: "Describe a page in English, get production-ready HTML in seconds",
    category: "code",
    icon: "🏗️",
    agentEndpoint: "/api/agents/page-builder",
    defaultInputs: { prompt: "" },
    preferredModel: "devstral",
    tags: ["html", "landing-page", "code", "deploy"],
    author: "Sovereign Matrix",
    installs: 1567,
  },
  {
    id: "bp-pii-shield",
    name: "PII Shield",
    description: "Scan any text for personally identifiable information and auto-redact",
    category: "security",
    icon: "🛡️",
    agentEndpoint: "/api/agents/pii-redactor",
    defaultInputs: { text: "" },
    preferredModel: "nemotron",
    guardrails: ["no-pii-leakage", "audit-trail-required"],
    tags: ["pii", "gdpr", "popia", "compliance", "security"],
    author: "Sovereign Matrix",
    installs: 1204,
  },
  {
    id: "bp-god-brain",
    name: "God Brain Analysis",
    description: "Chain 7 NVIDIA NIM models for the deepest analysis possible",
    category: "research",
    icon: "🧠",
    agentEndpoint: "/api/agents/god-brain",
    defaultInputs: { input: "", depth: "deep" },
    preferredModel: "nemotron",
    tags: ["analysis", "research", "deep-think", "multi-model"],
    author: "Sovereign Matrix",
    installs: 2103,
  },
  {
    id: "bp-competitor-ghost",
    name: "Ghost Fleet Competitor Attack",
    description: "Find unhappy competitor customers and draft personalized outreach",
    category: "sales",
    icon: "👻",
    agentEndpoint: "/api/agents/ghost-fleet",
    defaultInputs: { competitorName: "" },
    preferredModel: "nemotron",
    tags: ["competitor", "outreach", "linkedin", "sales"],
    author: "Sovereign Matrix",
    installs: 756,
  },
];

// ─── Built-in Cookbooks (Multi-Agent Workflows) ──────

export const COOKBOOKS: Cookbook[] = [
  {
    id: "cb-lead-to-meeting",
    name: "Lead to Meeting Pipeline",
    description: "Full pipeline: Find leads → Enrich → Write emails → Send sequence → Book meeting",
    category: "sales",
    icon: "🚀",
    steps: [
      {
        name: "Find Prospects",
        agentEndpoint: "/api/agents/leads",
        inputs: { action: "prospect", "params.niche": "{{niche}}", "params.location": "{{location}}" },
        outputMapping: { "leads": "prospects" },
      },
      {
        name: "Generate Email Sequence",
        agentEndpoint: "/api/agents/email-sequence",
        inputs: { action: "generate", businessDescription: "{{businessDescription}}", sequenceType: "cold-outreach", numberOfEmails: "5", targetAudience: "{{niche}}" },
        outputMapping: { "sequence": "emailSequence" },
      },
      {
        name: "Launch Outbound",
        agentEndpoint: "/api/agents/outbound",
        inputs: { prospectName: "{{prospects[0].name}}", prospectCompany: "{{prospects[0].company}}", yourOffer: "{{offer}}", channels: "email,linkedin" },
        requireApproval: true,
      },
    ],
    tags: ["sales", "leads", "email", "outbound", "pipeline"],
    author: "Sovereign Matrix",
    estimatedTime: "2-3 minutes",
  },
  {
    id: "cb-content-machine",
    name: "Content Machine",
    description: "Research → Write blog → Optimize SEO → Generate social posts → Schedule",
    category: "content",
    icon: "📝",
    steps: [
      {
        name: "Research Topic",
        agentEndpoint: "/api/agents/grounded-search",
        inputs: { query: "{{topic}} latest trends insights statistics" },
        outputMapping: { "result": "research" },
      },
      {
        name: "Write Blog Post",
        agentEndpoint: "/api/agents/blog-gen",
        inputs: { topic: "{{topic}}", keywords: "{{keywords}}", tone: "professional" },
        outputMapping: { "html": "blogPost", "metaDescription": "meta" },
      },
      {
        name: "SEO Optimization",
        agentEndpoint: "/api/agents/seo-dominator",
        inputs: { url: "{{blogUrl}}", action: "optimize" },
        outputMapping: { "recommendations": "seoFixes" },
      },
      {
        name: "Generate Social Posts",
        agentEndpoint: "/api/agents/organic-content",
        inputs: { topic: "{{topic}}", platforms: "linkedin,twitter,instagram" },
      },
    ],
    tags: ["content", "blog", "seo", "social", "pipeline"],
    author: "Sovereign Matrix",
    estimatedTime: "3-5 minutes",
  },
  {
    id: "cb-competitor-destroy",
    name: "Competitor Destroy Protocol",
    description: "Analyze competitor → Find gaps → Steal keywords → Target their unhappy customers",
    category: "research",
    icon: "⚔️",
    steps: [
      {
        name: "Competitor Deep Scan",
        agentEndpoint: "/api/agents/site-assassin",
        inputs: { url: "{{competitorUrl}}" },
        outputMapping: { "analysis": "competitorData" },
      },
      {
        name: "Keyword Gap Analysis",
        agentEndpoint: "/api/agents/seo-dominator",
        inputs: { url: "{{competitorUrl}}", action: "gap-analysis" },
        outputMapping: { "gaps": "keywordGaps" },
      },
      {
        name: "Ghost Fleet Outreach",
        agentEndpoint: "/api/agents/ghost-fleet",
        inputs: { competitorName: "{{competitorName}}" },
        requireApproval: true,
      },
    ],
    tags: ["competitor", "seo", "sales", "intelligence"],
    author: "Sovereign Matrix",
    estimatedTime: "2-4 minutes",
  },
  {
    id: "cb-security-audit",
    name: "Full Security Audit",
    description: "Scan for PII → Jailbreak test → Content safety → Compliance check",
    category: "security",
    icon: "🔒",
    steps: [
      {
        name: "PII Detection",
        agentEndpoint: "/api/agents/pii-redactor",
        inputs: { text: "{{content}}", action: "detect" },
        outputMapping: { "entities": "piiFound" },
      },
      {
        name: "Content Safety Scan",
        agentEndpoint: "/api/agents/content-safety",
        inputs: { text: "{{content}}" },
        outputMapping: { "safe": "isSafe", "category": "safetyCategory" },
      },
      {
        name: "Generate Compliance Report",
        agentEndpoint: "/api/agents/client-report",
        inputs: { type: "compliance", data: "{{piiFound}}", safetyResult: "{{isSafe}}" },
      },
    ],
    tags: ["security", "pii", "compliance", "audit", "gdpr"],
    author: "Sovereign Matrix",
    estimatedTime: "1-2 minutes",
  },
];

// ─── Helpers ─────────────────────────────────────────

export function getBlueprintsByCategory(category: BlueprintCategory): AgentBlueprint[] {
  return BLUEPRINTS.filter((b) => b.category === category);
}

export function getCookbooksByCategory(category: BlueprintCategory): Cookbook[] {
  return COOKBOOKS.filter((c) => c.category === category);
}

export function searchBlueprints(query: string): AgentBlueprint[] {
  const q = query.toLowerCase();
  return BLUEPRINTS.filter(
    (b) =>
      b.name.toLowerCase().includes(q) ||
      b.description.toLowerCase().includes(q) ||
      b.tags.some((t) => t.includes(q))
  );
}

export function searchCookbooks(query: string): Cookbook[] {
  const q = query.toLowerCase();
  return COOKBOOKS.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.tags.some((t) => t.includes(q))
  );
}
