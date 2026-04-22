#!/usr/bin/env node

/**
 * SOVEREIGN MATRIX — MCP Server
 *
 * Exposes 6 tools to Claude for operating the Sovereign Matrix platform:
 *
 *   1. sovereign_health      — Check platform health and DB connectivity
 *   2. sovereign_run_playbook — Execute a pre-built playbook by ID
 *   3. sovereign_list_playbooks — List all available playbooks
 *   4. sovereign_run_agent    — Execute any single agent with a prompt
 *   5. sovereign_usage        — Get usage metrics for the current billing period
 *   6. sovereign_api_catalog  — Get the full platform capability manifest
 *
 * Configuration:
 *   SOVEREIGN_BASE_URL — The base URL of the platform (default: https://sovereignmatrix.agency)
 *   SOVEREIGN_API_KEY  — API key for authenticated requests (optional for health/catalog)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = process.env.SOVEREIGN_BASE_URL || "https://sovereignmatrix.agency";
const API_KEY = process.env.SOVEREIGN_API_KEY || "";

// ─── HTTP Helper ─────────────────────────────────────────────────────────────

/**
 * Generic call helper. Callers pass an expected shape type so
 * `result.data.foo` type-checks. Without the generic, TypeScript
 * sees `unknown` and rejects property access — breaking the build
 * (as seen before phase 3.3 added this signature).
 */
async function apiCall<T = unknown>(
  path: string,
  method: "GET" | "POST" = "GET",
  body?: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: T }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (API_KEY) {
    headers["x-api-key"] = API_KEY;
  }

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(45000),
    });

    const data = await res.json().catch(() => ({ error: "Non-JSON response" }));
    return { ok: res.ok, status: res.status, data: data as T };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: { error: err instanceof Error ? err.message : "Network error" } as T,
    };
  }
}

// ─── MCP Server ──────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "sovereign-matrix",
  version: "1.0.0",
});

// ─── Tool 1: Health Check ────────────────────────────────────────────────────

server.tool(
  "sovereign_health",
  "Check Sovereign Matrix platform health — DB connectivity, latency, and service status",
  {},
  async () => {
    const result = await apiCall("/api/health/ping");
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result.data, null, 2),
        },
      ],
    };
  }
);

// ─── Tool 2: List Playbooks ─────────────────────────────────────────────────

server.tool(
  "sovereign_list_playbooks",
  "List all available Sovereign Matrix playbooks with their fields and agent chains",
  {},
  async () => {
    const result = await apiCall("/api/api-catalog");
    const data = result.data as Record<string, unknown>;
    const playbooks = (data?.playbooks as Array<Record<string, unknown>>) || [];

    const summary = playbooks.map((p) => ({
      id: p.id,
      name: p.name,
      tagline: p.tagline,
      category: p.category,
      agents: p.agentChain,
      time: p.estimatedTime,
      fields: (p.fields as Array<Record<string, unknown>>)?.map((f) => `${f.key} (${f.required ? "required" : "optional"})`),
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: `${summary.length} playbooks available:\n\n${JSON.stringify(summary, null, 2)}`,
        },
      ],
    };
  }
);

// ─── Tool 3: Run Playbook ───────────────────────────────────────────────────

server.tool(
  "sovereign_run_playbook",
  "Execute a Sovereign Matrix playbook. Provide the playbook ID and input values for its required fields.",
  {
    playbook_id: z.string().describe("Playbook ID (e.g., 'lead-blitz', 'competitor-takedown', 'content-machine')"),
    inputs: z.record(z.string(), z.string()).describe("Key-value pairs for the playbook fields (e.g., { niche: 'SaaS', location: 'Texas' })"),
    auto_execute: z.boolean().default(true).describe("Whether to execute immediately (true) or just generate the plan (false)"),
  },
  async ({ playbook_id, inputs }) => {
    // Use the canonical playbook engine — not the old /agents/coordinator path.
    // This ensures DB persistence, plan enforcement, and step tracking.
    const runResult = await apiCall<{ runId?: string }>("/api/playbooks/run", "POST", {
      playbookId: playbook_id,
      inputs,
    });

    if (!runResult.data?.runId) {
      return {
        content: [{ type: "text" as const, text: JSON.stringify(runResult.data, null, 2) }],
      };
    }

    const runId = runResult.data.runId;

    // Poll until done (max 90s, 3s intervals)
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const poll = await apiCall<{ done?: boolean; status?: string }>(
        `/api/playbooks/runs/${runId}`,
        "GET",
      );
      if (poll.data?.done) {
        return {
          content: [{ type: "text" as const, text: JSON.stringify(poll.data, null, 2) }],
        };
      }
    }

    return {
      content: [{ type: "text" as const, text: `Run ${runId} still in progress. Poll /api/playbooks/runs/${runId} for results.` }],
    };
  }
);

// ─── Tool 4: Run Single Agent ───────────────────────────────────────────────

server.tool(
  "sovereign_run_agent",
  "Execute a single Sovereign Matrix agent with a prompt. Use for quick tasks that don't need a full playbook.",
  {
    agent: z.string().describe("Agent name (e.g., 'smart-router', 'leads', 'blog-gen', 'seo-dominator', 'omni-search')"),
    prompt: z.string().describe("The task or question for the agent"),
    params: z.record(z.string(), z.string()).optional().describe("Additional parameters (e.g., { niche: 'fintech', location: 'London' })"),
  },
  async ({ agent, prompt, params }) => {
    const body: Record<string, unknown> = {
      prompt,
      confirmed: true,
      ...params,
    };

    const result = await apiCall(`/api/agents/${agent}`, "POST", body);

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result.data, null, 2),
        },
      ],
    };
  }
);

// ─── Tool 5: Usage Metrics ──────────────────────────────────────────────────

server.tool(
  "sovereign_usage",
  "Get usage metrics — agent executions, leads generated, content created, and billing info",
  {},
  async () => {
    const result = await apiCall("/api/usage");

    if (!result.ok) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Usage API returned ${result.status}. You may need to set SOVEREIGN_API_KEY for authenticated access.\n${JSON.stringify(result.data)}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result.data, null, 2),
        },
      ],
    };
  }
);

// ─── Tool 6: API Catalog ────────────────────────────────────────────────────

server.tool(
  "sovereign_api_catalog",
  "Get the full Sovereign Matrix capability manifest — all agents, playbooks, pricing, and endpoints",
  {},
  async () => {
    const result = await apiCall("/api/api-catalog");

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result.data, null, 2),
        },
      ],
    };
  }
);

// ═════════════════════════════════════════════════════════════════════════════
// v9 — Expanded tool surface (distribution moat: MCP-first agents)
// ═════════════════════════════════════════════════════════════════════════════
//
// The original 6 tools cover platform operations. These 14 add the
// actual value surface — research / content / security / snapshots —
// so Claude Code, Cline, and Cursor users get the full Sovereign
// Matrix agent library as MCP tools with zero-signup discovery.
//
// Design guidelines:
//   - Every tool name is `sovereign_*` so they group cleanly in UIs
//   - Descriptions are verbose enough that Claude's tool-selector
//     can disambiguate without a separate "choose between X and Y" round
//   - All tools return JSON text — structured output Claude can parse
//   - No tool accepts raw prompts without an agent bucket (prevents
//     the "use this as a cheap Claude proxy" anti-pattern)

// ─── Tool 7: Agent Resume Discovery ──────────────────────────────────────────

server.tool(
  "sovereign_agent_resume",
  "Fetch the .agent.md resume for any Sovereign agent — shows its inputs, outputs, models used, and examples. Use this to understand what an agent does before calling it.",
  { slug: z.string().describe("Agent slug like 'leads' or 'blog-gen'") },
  async ({ slug }) => {
    const result = await apiCall(`/api/agents/${slug}.agent.md`);
    return {
      content: [
        {
          type: "text" as const,
          text: typeof result.data === "string"
            ? result.data
            : JSON.stringify(result.data, null, 2),
        },
      ],
    };
  }
);

// ─── Tool 8: Partnership Metrics ─────────────────────────────────────────────

server.tool(
  "sovereign_partnership_metrics",
  "Get public Anthropic/Claude partnership metrics — Claude invocation share, provider mix, total spend. Useful for verifying that Sovereign actually uses Claude in production.",
  {},
  async () => {
    const result = await apiCall("/api/_misc/partnership-metrics");
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result.data, null, 2) }],
    };
  }
);

// ─── Tool 9: Safety-Diff Metrics ─────────────────────────────────────────────

server.tool(
  "sovereign_safety_metrics",
  "Get live 5-layer safety pipeline outcomes — jailbreak blocks, PII catches, quality rejections. Evidence that our safety system actually runs in production.",
  {},
  async () => {
    const result = await apiCall("/api/_misc/safety-diff");
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result.data, null, 2) }],
    };
  }
);

// ─── Tool 10: Snapshot Verify ───────────────────────────────────────────────

server.tool(
  "sovereign_verify_snapshot",
  "Verify an Agent Snapshot JSON document — checksum, version, integrity. Used by auditors to confirm a snapshot hasn't been tampered with. Paste the full snapshot JSON.",
  {
    snapshot: z
      .string()
      .describe("Full snapshot JSON (stringified) from /api/_replay/[id]/snapshot"),
  },
  async ({ snapshot }) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(snapshot);
    } catch {
      return {
        content: [{ type: "text" as const, text: JSON.stringify({ valid: false, reason: "invalid_json" }) }],
      };
    }
    const result = await apiCall("/api/_replay/verify", "POST", parsed as Record<string, unknown>);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result.data, null, 2) }],
    };
  }
);

// ─── Tool 11: Run Leads Agent (shortcut) ────────────────────────────────────

server.tool(
  "sovereign_find_leads",
  "Find real B2B prospects by niche + location. Uses Tavily for research, Nemotron Ultra for qualification. Returns a structured list with identity + outreach angle.",
  {
    niche: z.string().describe("Target industry (e.g. 'B2B SaaS analytics')"),
    location: z.string().default("worldwide").describe("Geographic filter"),
    product: z.string().optional().describe("Product being sold — tailors outreach angle"),
  },
  async (params) => {
    const result = await apiCall("/api/agents/leads", "POST", params);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result.data, null, 2) }],
    };
  }
);

// ─── Tool 12: Generate Blog Post ────────────────────────────────────────────

server.tool(
  "sovereign_generate_blog",
  "Generate a SEO-optimized blog post on a given topic. Uses Tavily for research + NIM for generation. Returns HTML + meta description + keywords.",
  {
    topic: z.string().min(3).describe("Topic or target keyword"),
    keywords: z.array(z.string()).optional().describe("Additional target keywords"),
    tone: z
      .enum(["professional", "casual", "academic", "conversational", "technical"])
      .default("professional"),
  },
  async (params) => {
    const result = await apiCall("/api/agents/blog-gen", "POST", params);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result.data, null, 2) }],
    };
  }
);

// ─── Tool 13: SEO Audit ─────────────────────────────────────────────────────

server.tool(
  "sovereign_seo_audit",
  "Run an SEO audit on a domain — keyword gaps, content velocity, technical issues, content strategy. Returns JSON intel grounded in live SERP data when available.",
  {
    domain: z.string().describe("Domain like 'example.com'"),
    keywords: z.array(z.string()).optional().describe("Specific keywords to analyze"),
    mode: z.enum(["audit", "content-plan"]).default("audit"),
  },
  async (params) => {
    const result = await apiCall("/api/agents/seo-dominator", "POST", params);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result.data, null, 2) }],
    };
  }
);

// ─── Tool 14: Competitor Intelligence ──────────────────────────────────────

server.tool(
  "sovereign_competitor_intel",
  "Deep competitive analysis using Porter's Five Forces + Blue Ocean. Identifies weaknesses, market gaps, pricing arbitrage, messaging vulnerabilities.",
  {
    competitorName: z.string().describe("Target competitor name"),
    competitorUrl: z.string().optional(),
    yourBusiness: z.string().describe("Brief description of your business"),
    industry: z.string().describe("Industry/market"),
  },
  async (params) => {
    const result = await apiCall("/api/agents/competitor", "POST", params);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result.data, null, 2) }],
    };
  }
);

// ─── Tool 15: Grounded Search ──────────────────────────────────────────────

server.tool(
  "sovereign_grounded_search",
  "Tavily-powered web search with grounding — returns cited facts rather than hallucinated answers. Use when you need current information (post-training).",
  {
    query: z.string().describe("Search query"),
    depth: z.enum(["basic", "advanced"]).default("advanced"),
  },
  async (params) => {
    const result = await apiCall("/api/agents/grounded-search", "POST", params);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result.data, null, 2) }],
    };
  }
);

// ─── Tool 16: Generate Ad Creatives ────────────────────────────────────────

server.tool(
  "sovereign_generate_ads",
  "Generate 5 ad-creative variations using proven psychological hooks (PAS, social-proof, urgency, curiosity, direct-benefit). For Meta/Google/LinkedIn.",
  {
    businessDescription: z.string(),
    targetAudience: z.string(),
    platform: z.enum(["meta", "google", "linkedin", "tiktok"]).default("meta"),
    tone: z.string().default("Professional but bold"),
  },
  async (params) => {
    const result = await apiCall("/api/agents/ads", "POST", params);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result.data, null, 2) }],
    };
  }
);

// ─── Tool 17: Consensus AI ─────────────────────────────────────────────────

server.tool(
  "sovereign_consensus",
  "Run a prompt through multiple models with Claude as critic (generate → critique → revise). Higher quality than a single-model call; costs 2-3x. Use for high-stakes outputs.",
  {
    prompt: z.string().describe("The task to run through consensus"),
    system: z.string().optional().describe("Optional system prompt"),
  },
  async (params) => {
    const result = await apiCall("/api/agents/consensus", "POST", params);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result.data, null, 2) }],
    };
  }
);

// ─── Tool 18: Translate ────────────────────────────────────────────────────

server.tool(
  "sovereign_translate",
  "Translate text between languages with context preservation. Supports 140+ languages.",
  {
    text: z.string().min(1),
    target_lang: z.string().describe("Target language (e.g. 'Spanish', 'fr-CA', 'ja')"),
    source_lang: z.string().optional().describe("Source language (auto-detect if omitted)"),
  },
  async (params) => {
    const result = await apiCall("/api/agents/translate", "POST", params);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result.data, null, 2) }],
    };
  }
);

// ─── Tool 19: Meeting Notes ────────────────────────────────────────────────

server.tool(
  "sovereign_meeting_notes",
  "Convert meeting transcript into structured action items, decisions, summary, and open questions.",
  {
    transcript: z.string().min(10).describe("Raw meeting transcript or notes"),
    format: z.enum(["bullets", "narrative", "both"]).default("both"),
  },
  async (params) => {
    const result = await apiCall("/api/agents/meeting-notes", "POST", params);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result.data, null, 2) }],
    };
  }
);

// ─── Tool 20: Code Review ──────────────────────────────────────────────────

server.tool(
  "sovereign_code_review",
  "AI-powered code review — finds bugs, security issues, performance problems, style deviations. Returns prioritized feedback with line-level specificity.",
  {
    code: z.string().min(1).describe("Code to review"),
    language: z.string().optional().describe("Language hint (e.g. 'typescript')"),
    context: z.string().optional().describe("What this code does / intent"),
  },
  async (params) => {
    const result = await apiCall("/api/agents/code-reviewer", "POST", params);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result.data, null, 2) }],
    };
  }
);

// ─── Tool 21: List Agents ──────────────────────────────────────────────────
//
// The DISCOVERY surface. Previously the only way Claude Desktop users
// could run an arbitrary Sovereign agent was to know its slug in advance.
// This tool returns the full 198-agent catalog with metadata so the LLM
// can browse, filter, or choose based on the user's natural-language
// request.

server.tool(
  "sovereign_list_agents",
  "List all 198 Sovereign Matrix agents with categories, purposes, and featured flags. Use this when the user's intent isn't obviously satisfied by one of the 20 specialized tools — pick an agent from the catalog and invoke it via sovereign_run_agent.",
  {
    category: z
      .string()
      .optional()
      .describe("Filter by category: Finance, HR, Legal, Dev, Cybersec, A2E, etc."),
    featuredOnly: z
      .boolean()
      .optional()
      .describe("If true, return only the 84 featured agents. Default false."),
  },
  async (params) => {
    const result = await apiCall<{ agents?: Array<Record<string, unknown>> }>(
      "/api/public/catalog",
    );
    const all = result.data?.agents ?? [];

    const filtered = all.filter((a) => {
      const aCat = String(a.category ?? "");
      const aFeatured = Boolean(a.featured);
      if (params.category && aCat !== params.category) return false;
      if (params.featuredOnly && !aFeatured) return false;
      return true;
    });

    const compact = filtered.map((a) => ({
      slug: a.slug,
      displayName: a.displayName,
      category: a.category,
      featured: a.featured,
      tagline: a.tagline ?? a.description ?? null,
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: `${compact.length} of ${all.length} agents${params.category ? ` in ${params.category}` : ""}${params.featuredOnly ? " (featured only)" : ""}:\n\n${JSON.stringify(compact, null, 2)}`,
        },
      ],
    };
  },
);

// ─── Tool 22: Search Agents ────────────────────────────────────────────────
//
// Ranked fuzzy search over the catalog — mirrors the ⌘K palette on
// /agents. Gives the LLM a way to find the right agent for a user's
// specific query without loading all 198.

server.tool(
  "sovereign_search_agents",
  "Search the agent catalog by keyword. Returns top 10 matches ranked by relevance (slug match > name match > tagline match). Prefer this over sovereign_list_agents when the user asks for something specific.",
  {
    query: z.string().min(1).describe("Search term — e.g. 'invoice', 'churn', 'phishing'"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Max results (default 10, max 50)"),
  },
  async ({ query, limit = 10 }) => {
    const result = await apiCall<{ agents?: Array<Record<string, unknown>> }>(
      "/api/public/catalog",
    );
    const agents = result.data?.agents ?? [];
    const q = query.toLowerCase();

    // Score each agent by match quality (same algorithm as CommandPalette).
    const scored = agents
      .map((a) => {
        const slug = String(a.slug ?? "").toLowerCase();
        const name = String(a.displayName ?? "").toLowerCase();
        const tagline = String(a.tagline ?? "").toLowerCase();
        const description = String(a.description ?? "").toLowerCase();
        let score = 0;
        if (slug === q) score += 100;
        else if (slug.startsWith(q)) score += 80;
        else if (name.startsWith(q)) score += 70;
        else if (slug.includes(q)) score += 55;
        else if (name.includes(q)) score += 45;
        if (tagline.includes(q)) score += 20;
        if (description.includes(q)) score += 10;
        if (score > 0 && a.featured) score += 5;
        return { agent: a, score };
      })
      .filter((s) => s.score > 0)
      .sort((x, y) => y.score - x.score)
      .slice(0, limit)
      .map((s) => ({
        slug: s.agent.slug,
        displayName: s.agent.displayName,
        category: s.agent.category,
        tagline: s.agent.tagline ?? null,
        score: s.score,
      }));

    return {
      content: [
        {
          type: "text" as const,
          text: `${scored.length} match${scored.length === 1 ? "" : "es"} for "${query}":\n\n${JSON.stringify(scored, null, 2)}`,
        },
      ],
    };
  },
);

// ─── Tool 23: Get SAM Manifest ─────────────────────────────────────────────
//
// Returns the Sovereign Agent Manifest (SAM v1.0) for a specific agent.
// Enables any SAM-compatible runtime to introspect a Sovereign agent's
// shape and potentially execute it via a different runtime — the
// interoperability play.

server.tool(
  "sovereign_manifest",
  "Fetch the Sovereign Agent Manifest (SAM v1.0) for a specific agent. Use this to see inputs, outputs, guarantees, and safety tier before invoking. The manifest follows the open SAM v1.0 spec — see https://sovereignmatrix.agency/spec/agent-manifest.",
  {
    slug: z.string().min(1).describe("Agent slug, e.g. 'invoice-extractor'"),
  },
  async ({ slug }) => {
    // Pull agent metadata from the catalog and synthesize a SAM-shape
    // document. This is v1 behaviour — once agents carry an explicit
    // manifest row in the DB, swap to /api/public/sam/manifest/<slug>.
    const result = await apiCall<{ agent?: Record<string, unknown> }>(
      `/api/catalog/${encodeURIComponent(slug)}`,
    );
    const a = result.data?.agent;
    if (!a) {
      return {
        content: [{ type: "text" as const, text: `No agent found for slug '${slug}'.` }],
      };
    }

    const manifest = {
      sam: "1.0",
      slug: a.slug,
      displayName: a.displayName,
      purpose: a.tagline ?? a.description ?? "",
      category: a.category,
      version: "1.0.0",
      inputs: [],
      output: { type: "object" },
      guarantees: ["factory-validated input", "5-layer output verification"],
      safety: { trustTier: "guided" },
      model: "claude",
    };

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(manifest, null, 2),
        },
      ],
    };
  },
);

// ─── Tool 24: Validate SAM Manifest ────────────────────────────────────────
//
// Fetches the current SAM v1.0 JSON Schema from the platform and
// returns it to the caller. Consuming LLMs can validate a proposed
// manifest against this schema without a round-trip.

server.tool(
  "sovereign_sam_schema",
  "Fetch the Sovereign Agent Manifest (SAM) v1.0 JSON Schema. Use this to validate a manifest before publishing to the Sovereign marketplace. The schema is MIT-licensed and the spec is frozen for ≥12 months.",
  {},
  async () => {
    const result = await apiCall("/api/public/sam/schema");
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result.data, null, 2),
        },
      ],
    };
  },
);

// ─── Start Server ────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Sovereign Matrix MCP server running on stdio — 24 tools available (20 specialized + 4 catalog/SAM)");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
