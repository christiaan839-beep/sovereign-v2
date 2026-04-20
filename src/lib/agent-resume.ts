/**
 * AGENT RESUME (.agent.md) — a portable spec for a single agent.
 *
 * Goal
 * ----
 * The way `README.md` is the universal way to describe a repo, and
 * `package.json` is the way to describe a Node package, `.agent.md`
 * is the way to describe a *deployable AI agent* — so that Claude
 * Code, Cursor, Copilot, or any future agent-orchestrator can discover
 * the agent's capabilities without reading its source.
 *
 * Format
 * ------
 * Front-matter YAML for machine fields, markdown body for human prose.
 *
 *   ---
 *   slug: leads
 *   version: 2.1.0
 *   category: growth
 *   tier: 2                   # action-tier: 1 autonomous | 2 confirm | 3 admin
 *   models: [nemotron-ultra]  # primary model(s) used
 *   providers: [nvidia, tavily]
 *   latency_p50_ms: 4200
 *   latency_p95_ms: 12000
 *   quality_score: 0.84
 *   ---
 *
 *   # Leads
 *   Find real B2B prospects using live Tavily research, then qualify
 *   them with Nemotron Ultra.
 *
 *   ## Inputs
 *   | field    | type   | required | example                |
 *   | niche    | string | yes      | "B2B SaaS analytics"   |
 *   | location | string | no       | "San Francisco"        |
 *
 *   ## Outputs
 *   ```json
 *   { "success": true, "leads": [...], "total": 8 }
 *   ```
 *
 *   ## Example
 *   POST /api/agents/leads  { "niche": "dev tools" }
 *
 * Two surface-area methods: `buildAgentResume()` renders the string
 * for a given slug, and the HTTP endpoint GET /api/agents/<slug>.agent
 * returns it with content-type `text/markdown; charset=utf-8`.
 */

import { AGENT_REGISTRY } from "@/app/api/agents/registry";
import { getActionTier } from "@/lib/action-tiers";

export interface AgentResumeMeta {
  slug: string;
  version?: string;
  category?: string;
  tier: 1 | 2 | 3;
  models?: string[];
  providers?: string[];
  latency_p50_ms?: number;
  latency_p95_ms?: number;
  quality_score?: number;
}

export interface AgentResumeBody {
  title: string;
  summary: string;
  inputs?: Array<{ field: string; type: string; required: boolean; example?: string; notes?: string }>;
  outputs?: { type: "json" | "sse" | "binary"; example: string };
  examples?: Array<{ description: string; request: string }>;
}

export interface AgentResume {
  meta: AgentResumeMeta;
  body: AgentResumeBody;
}

/**
 * Serialize an AgentResume into the canonical `.agent.md` text format.
 * Keeps field order deterministic so diffs are minimal.
 */
export function serializeAgentResume(r: AgentResume): string {
  const fm = [
    "---",
    `slug: ${r.meta.slug}`,
    r.meta.version !== undefined ? `version: ${r.meta.version}` : null,
    r.meta.category !== undefined ? `category: ${r.meta.category}` : null,
    `tier: ${r.meta.tier}`,
    r.meta.models && r.meta.models.length ? `models: [${r.meta.models.join(", ")}]` : null,
    r.meta.providers && r.meta.providers.length ? `providers: [${r.meta.providers.join(", ")}]` : null,
    r.meta.latency_p50_ms !== undefined ? `latency_p50_ms: ${r.meta.latency_p50_ms}` : null,
    r.meta.latency_p95_ms !== undefined ? `latency_p95_ms: ${r.meta.latency_p95_ms}` : null,
    r.meta.quality_score !== undefined ? `quality_score: ${r.meta.quality_score}` : null,
    "---",
    "",
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  let md = `# ${r.body.title}\n\n${r.body.summary}\n\n`;

  if (r.body.inputs && r.body.inputs.length > 0) {
    md += "## Inputs\n\n";
    md += "| field | type | required | example |\n";
    md += "|---|---|---|---|\n";
    for (const inp of r.body.inputs) {
      const ex = inp.example ?? "";
      md += `| \`${inp.field}\` | \`${inp.type}\` | ${inp.required ? "yes" : "no"} | ${ex} |\n`;
    }
    md += "\n";
  }

  if (r.body.outputs) {
    md += "## Outputs\n\n";
    md += "```" + r.body.outputs.type + "\n";
    md += r.body.outputs.example + "\n";
    md += "```\n\n";
  }

  if (r.body.examples && r.body.examples.length > 0) {
    md += "## Examples\n\n";
    for (const ex of r.body.examples) {
      md += `**${ex.description}**\n\n`;
      md += "```bash\n" + ex.request + "\n```\n\n";
    }
  }

  return fm + md;
}

/**
 * Registry of per-agent resume bodies. Agents are expected to contribute
 * their own body here (one-line import is the cheapest ergonomic). Agents
 * that don't contribute a body get an auto-generated skeleton, which is
 * better than a 404 for discovery tooling.
 */
const RESUME_BODIES: Record<string, AgentResumeBody> = {
  leads: {
    title: "Leads",
    summary:
      "Find real B2B prospects using live Tavily research, then qualify them with Nemotron Ultra. Self-heals on non-JSON or zero-leads by reframing the niche.",
    inputs: [
      { field: "niche", type: "string", required: true, example: '"B2B SaaS analytics"' },
      { field: "location", type: "string", required: false, example: '"San Francisco"' },
      { field: "product", type: "string", required: false, example: '"usage-based billing"' },
    ],
    outputs: {
      type: "json",
      example: '{\n  "success": true,\n  "leads": [{ "company_name": "…", "industry": "…", "score": 8 }],\n  "total": 8\n}',
    },
    examples: [
      {
        description: "Find dev-tools prospects with context",
        request: `curl -X POST https://sovereignmatrix.agency/api/agents/leads \\\n  -H "Content-Type: application/json" \\\n  -d '{"niche": "developer tools", "location": "remote"}'`,
      },
    ],
  },
  "blog-gen": {
    title: "Blog Generator",
    summary:
      "Autonomous SEO blog pipeline: Tavily researches the topic, DeepSeek V3.2 writes a 1500-2000 word article with meta tags, returns publishable HTML.",
    inputs: [
      { field: "topic", type: "string", required: true, example: '"agentic AI workflows"' },
      { field: "keywords", type: "string[]", required: false, example: '["claude code", "mcp"]' },
      { field: "tone", type: '"professional"|"casual"|"technical"', required: false, example: '"technical"' },
    ],
    outputs: {
      type: "json",
      example:
        '{\n  "success": true,\n  "slug": "agentic-ai-workflows",\n  "html": "<article>…</article>",\n  "seo": { "title": "…", "description": "…", "keywords": [...] }\n}',
    },
  },
  "seo-dominator": {
    title: "SEO Dominator",
    summary:
      "Keyword-gap analysis, content-velocity scoring, SERP intelligence. Two modes: `audit` (full-domain review) and `content-plan` (30-day calendar).",
    inputs: [
      { field: "domain", type: "string", required: true, example: '"example.com"' },
      { field: "keywords", type: "string[]", required: false },
      { field: "mode", type: '"audit"|"content-plan"', required: false, example: '"audit"' },
    ],
  },
  competitor: {
    title: "Competitor Intel",
    summary:
      "Deep competitive analysis using Porter's Five Forces + Blue Ocean Strategy to identify weaknesses, pricing arbitrage, and messaging vulnerabilities.",
    inputs: [
      { field: "competitorName", type: "string", required: false, example: '"Clay"' },
      { field: "yourBusiness", type: "string", required: false, example: '"AI agent platform"' },
      { field: "industry", type: "string", required: false, example: '"marketing ops"' },
    ],
  },
  "abm-artillery": {
    title: "ABM Artillery",
    summary:
      "Account-Based Marketing outreach. Tavily researches the target company, Mistral Nemotron writes a personalized cold email, Resend fires it (optional).",
    inputs: [
      { field: "companyName", type: "string", required: true, example: '"Acme Robotics"' },
      { field: "targetEmail", type: "string (email)", required: false, example: '"ceo@acme.com"' },
      { field: "context", type: "string", required: false, example: '"Series B, 40 engineers"' },
    ],
  },
  "slack-notify": {
    title: "Slack Notify",
    summary:
      "Send a Block Kit message to the user's connected Slack workspace. Requires OAuth — wire up at `/dashboard/integrations`. Tier-2 (confirmation required for direct UI calls).",
    inputs: [
      { field: "channel", type: "string", required: true, example: '"#sales"' },
      { field: "text", type: "string", required: true, example: '"Lead qualified: Acme (score 92)"' },
      { field: "title", type: "string", required: false, example: '"New Qualified Lead"' },
      { field: "context", type: "string", required: false, example: '"Triggered by Lead Blitz"' },
    ],
  },
};

/** Build a full resume for the given agent slug. Returns null if unknown. */
export function buildAgentResume(slug: string): AgentResume | null {
  if (!(slug in AGENT_REGISTRY)) return null;

  const tierInfo = getActionTier(slug);
  const body = RESUME_BODIES[slug] ?? {
    title: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    summary:
      "No human-authored summary yet. Add an entry to `src/lib/agent-resume.ts::RESUME_BODIES` to describe this agent's purpose, inputs, and example outputs.",
  };

  return {
    meta: {
      slug,
      tier: tierInfo.tier,
      category: tierInfo.tier === 1 ? "autonomous" : tierInfo.tier === 2 ? "confirm" : "admin",
    },
    body,
  };
}

/**
 * List every slug that has a hand-authored resume body. Discovery
 * clients can prioritize these over skeleton-only entries.
 */
export function listAuthoredResumes(): string[] {
  return Object.keys(RESUME_BODIES).sort();
}
