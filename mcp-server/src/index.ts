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

async function apiCall(
  path: string,
  method: "GET" | "POST" = "GET",
  body?: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: unknown }> {
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
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      data: { error: err instanceof Error ? err.message : "Network error" },
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
  async ({ playbook_id, inputs, auto_execute }) => {
    const result = await apiCall("/api/agents/coordinator", "POST", {
      playbook_id,
      inputs,
      auto_execute,
      confirmed: true,
    });

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

// ─── Start Server ────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Sovereign Matrix MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
