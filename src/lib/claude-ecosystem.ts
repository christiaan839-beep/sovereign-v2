/**
 * SOVEREIGN MATRIX — Claude Ecosystem Integration
 *
 * Consolidates all Anthropic/Claude capabilities available to the platform:
 * 1. Extended Thinking — deep reasoning with budget_tokens
 * 2. Interleaved Thinking — reasoning between tool calls
 * 3. Citations API — source-grounded responses
 * 4. Computer Use — browser automation
 * 5. Tool Search — dynamic tool discovery
 * 6. Programmatic Tool Calling — code-driven tool orchestration
 * 7. Agent SDK — the same engine that powers Claude Code
 * 8. MCP Protocol — Model Context Protocol for tool integration
 * 9. Prompt Caching — 90% token cost reduction
 * 10. Batch API — async large-scale processing
 */

// ─── Types ──────────────────────────────────────────────

export type CapabilityStatus = "enabled" | "disabled" | "available";

export interface CapabilityConfig {
  id: string;
  name: string;
  status: CapabilityStatus;
  description: string;
  /** Beta header required to activate this capability (if any) */
  betaHeader?: string;
  /** Which agents in the platform use this capability */
  usedBy: string[];
  /** Additional metadata (model version, token limits, etc.) */
  meta?: Record<string, string | number | boolean>;
}

export interface ClaudeModelInfo {
  id: string;
  name: string;
  provider: "Anthropic";
  contextWindow: number;
  maxOutputTokens: number;
  capabilities: string[];
  released: string;
}

export interface UsageReportEntry {
  capabilityId: string;
  capabilityName: string;
  agentCount: number;
  agents: string[];
  status: CapabilityStatus;
}

export interface UsageReport {
  generatedAt: string;
  totalCapabilities: number;
  enabledCount: number;
  entries: UsageReportEntry[];
}

// ─── Capability Registry ────────────────────────────────

const CAPABILITIES: CapabilityConfig[] = [
  {
    id: "extended-thinking",
    name: "Extended Thinking",
    status: "enabled",
    description:
      "Deep reasoning mode with configurable budget_tokens. Claude produces internal thinking blocks before responding, improving accuracy on complex tasks.",
    betaHeader: undefined,
    usedBy: ["claude-think", "deep-think", "god-brain", "agentic-chain"],
    meta: { budgetTokens: 10000, thinkingType: "enabled" },
  },
  {
    id: "interleaved-thinking",
    name: "Interleaved Thinking",
    status: "enabled",
    description:
      "Reasoning between tool calls. Claude produces thinking blocks between each tool use step, enabling deeper analysis in agentic loops.",
    betaHeader: "interleaved-thinking-2025-05-14",
    usedBy: ["claude-think", "agentic-chain", "orchestrator"],
    meta: { requiresToolUse: true },
  },
  {
    id: "citations",
    name: "Citations API",
    status: "enabled",
    description:
      "Source-grounded responses with document citations. Claude references specific passages from provided documents, enabling verifiable research output.",
    betaHeader: "citations-2025-01-24",
    usedBy: ["grounded-search", "doc-intel", "rag-pipeline", "contract-analyzer"],
    meta: { sourceTypes: "text/plain, text/html, application/pdf" },
  },
  {
    id: "computer-use",
    name: "Computer Use",
    status: "enabled",
    description:
      "Browser and desktop automation via Claude. Controls mouse, keyboard, and screen to interact with any application on behalf of the user.",
    betaHeader: "computer-use-2025-01-24",
    usedBy: ["computer-use"],
    meta: { modelVersion: "claude-sonnet-4-6", toolVersion: "2025-11-24" },
  },
  {
    id: "tool-search",
    name: "Tool Search",
    status: "available",
    description:
      "Dynamic tool discovery across large tool sets. When the available tool count exceeds model limits, Tool Search lets Claude find the right tool on demand.",
    usedBy: [],
    meta: { maxToolsPerSearch: 40 },
  },
  {
    id: "programmatic-tool-calling",
    name: "Programmatic Tool Calling",
    status: "enabled",
    description:
      "Code-driven tool orchestration with automatic execution loops. Claude calls tools, receives results, and iterates until the task is complete.",
    usedBy: [
      "agentic-chain",
      "chain-reactor",
      "orchestrator",
      "smart-router",
      "god-brain",
      "swarm",
    ],
    meta: { maxIterations: 10, model: "claude-sonnet-4-6" },
  },
  {
    id: "agent-sdk",
    name: "Agent SDK",
    status: "available",
    description:
      "The same agentic loop engine that powers Claude Code. Provides structured agent orchestration with tool execution, guardrails, and handoffs between sub-agents.",
    usedBy: [],
    meta: { package: "@anthropic-ai/agent-sdk" },
  },
  {
    id: "mcp-protocol",
    name: "MCP Protocol",
    status: "enabled",
    description:
      "Model Context Protocol for standardized tool integration. Connects Claude to external services (databases, APIs, file systems) via a unified protocol.",
    usedBy: ["firecrawl", "code-sandbox", "rag-pipeline"],
    meta: { connectedTools: 7, protocol: "stdio / SSE / HTTP" },
  },
  {
    id: "prompt-caching",
    name: "Prompt Caching",
    status: "enabled",
    description:
      "Ephemeral caching on system prompts reduces input token costs by up to 90%. Cached tokens are re-used across requests within the TTL window.",
    betaHeader: "prompt-caching-2024-07-31",
    usedBy: [
      "god-brain",
      "agentic-chain",
      "claude-think",
      "deep-think",
      "orchestrator",
      "grounded-search",
    ],
    meta: { costReduction: "90%", cacheType: "ephemeral", ttlMinutes: 5 },
  },
  {
    id: "batch-api",
    name: "Batch API",
    status: "available",
    description:
      "Asynchronous large-scale processing. Submit up to 100,000 requests in a single batch for 50% cost reduction with 24-hour turnaround.",
    usedBy: [],
    meta: { maxRequestsPerBatch: 100000, costReduction: "50%", sla: "24h" },
  },
];

// ─── Model Registry ─────────────────────────────────────

const CLAUDE_MODELS: ClaudeModelInfo[] = [
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "Anthropic",
    contextWindow: 1000000,
    maxOutputTokens: 64000,
    capabilities: [
      "extended-thinking",
      "interleaved-thinking",
      "adaptive-thinking",
      "tool-use",
      "programmatic-tool-calling",
      "citations",
      "computer-use",
      "prompt-caching",
      "context-compaction",
      "vision",
    ],
    released: "2026-03-01",
  },
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    provider: "Anthropic",
    contextWindow: 1000000,
    maxOutputTokens: 128000,
    capabilities: [
      "extended-thinking",
      "interleaved-thinking",
      "adaptive-thinking",
      "tool-use",
      "programmatic-tool-calling",
      "citations",
      "prompt-caching",
      "context-compaction",
      "vision",
      "agent-sdk",
      "max-effort-thinking",
    ],
    released: "2026-02-05",
  },
  {
    id: "claude-mythos",
    name: "Claude Mythos (Preview)",
    provider: "Anthropic",
    contextWindow: 1000000,
    maxOutputTokens: 128000,
    capabilities: [
      "next-gen-reasoning",
      "cybersecurity",
      "advanced-coding",
      "academic-reasoning",
    ],
    released: "TBD — early access expected Q2 2026",
  },
  {
    id: "claude-haiku-4-5-20251001",
    name: "Claude Haiku 4.5",
    provider: "Anthropic",
    contextWindow: 200000,
    maxOutputTokens: 8192,
    capabilities: ["tool-use", "prompt-caching", "vision"],
    released: "2025-10-01",
  },
];

// ─── Public API ─────────────────────────────────────────

/**
 * Returns all Claude ecosystem capabilities with their current status
 * and which platform agents consume them.
 */
export function getCapabilities(): CapabilityConfig[] {
  return CAPABILITIES;
}

/**
 * Returns detailed information about all available Claude models,
 * including context windows, output limits, and supported features.
 */
export function getModelInfo(): ClaudeModelInfo[] {
  return CLAUDE_MODELS;
}

/**
 * Generates a usage report showing which capabilities are active
 * and how many agents depend on each one.
 */
export function getUsageReport(): UsageReport {
  const entries: UsageReportEntry[] = CAPABILITIES.map((cap) => ({
    capabilityId: cap.id,
    capabilityName: cap.name,
    agentCount: cap.usedBy.length,
    agents: cap.usedBy,
    status: cap.status,
  }));

  return {
    generatedAt: new Date().toISOString(),
    totalCapabilities: CAPABILITIES.length,
    enabledCount: CAPABILITIES.filter((c) => c.status === "enabled").length,
    entries,
  };
}
