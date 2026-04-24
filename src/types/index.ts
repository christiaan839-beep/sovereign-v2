/** Shared types for the SOVEREIGN platform */

// ─── AI ──────────────────────────────────────────────
// Short canonical provider / model keys. The list below is the SET that
// the router in src/lib/ai.ts branches on; frontier providers added
// 2026-04-24 (UMP-4 — see docs/superpowers/specs/2026-04-24-frontier-providers-design.md).
// The `string` fallback at the end keeps this permissive: callers can
// pass full model slugs like "gpt-5" or "openai/gpt-4.1" and the router
// handles them. The union branches above give IDE autocomplete for the
// common cases without forcing narrow typing.
export type AIModel =
  // Existing providers
  | "gemini"
  | "claude"
  | "nim"
  | "ollama"
  | "groq"
  | "deepseek"
  | "mistral"
  | "qwen"
  | "cerebras"
  // Frontier providers (added UMP-4)
  | "openai"
  | "gpt5"
  | "gpt-5"
  | "gpt-4.1"
  | "o1"
  | "o3"
  | "o3-mini"
  | "xai"
  | "grok"
  | "grok-3"
  | "grok-4"
  | "mistral-direct"
  | "cohere"
  | "command-r-plus"
  | "command-r"
  | "openrouter"
  | "together"
  | "llama4-405b"
  | "deepseek-v3-together"
  | "databricks"
  | "dbrx"
  // Permissive escape: any string (e.g. "owner/model" for OpenRouter, or
  // a custom slug). IDE autocomplete prefers the named options above.
  | (string & {});
export type TaskType = "content" | "analysis" | "code" | "sales";

export interface AIOptions {
  model?: AIModel;
  system?: string;
  taskType?: TaskType;
  maxTokens?: number;
  /** Enable Claude Extended Thinking for deep reasoning tasks */
  thinking?: boolean;
  /** Use Claude Opus 4.6 for maximum reasoning (higher cost, BYOK recommended) */
  useOpus?: boolean;
  /** Use Gemini 2.5 Pro instead of Flash (available on Google AI Ultra plan) */
  useGeminiPro?: boolean;
  /**
   * Enable read-through response caching. Identical (prompt, system, model)
   * tuples return cached results (TTL: 15min default). Opt-in because some
   * callers want fresh output every call (creative tasks, time-sensitive).
   */
  cache?: boolean | { ttlSeconds?: number };
}

// ─── Agents ──────────────────────────────────────────
export interface AgentResult {
  success: boolean;
  agent: string;
  output: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

// ─── Memory ──────────────────────────────────────────
export interface MemoryEntry {
  id: string;
  text: string;
  embedding: number[];
  metadata: Record<string, string>;
  timestamp: string;
}

export interface MemorySearchResult {
  entry: MemoryEntry;
  score: number;
}

// ─── Swarm ───────────────────────────────────────────
export interface SwarmConfig {
  goal: string;
  creatorSystem: string;
  criticSystem: string;
  maxRounds?: number;
  model?: AIModel;
}

export interface SwarmStep {
  agent: "Creator" | "Critic";
  output: string;
  score?: number;
  approved?: boolean;
  timestamp: string;
}

export interface SwarmResult {
  finalOutput: string;
  steps: SwarmStep[];
  approved: boolean;
  rounds: number;
}

// ─── Ghost Mode ──────────────────────────────────────
export interface GhostAction {
  id: string;
  type: "LAUNCH" | "STOP" | "SCALE" | "WAIT";
  platform: string;
  budget: number;
  reasoning: string;
  adCopy?: string;
  timestamp: string;
}

export interface Campaign {
  id: string;
  name: string;
  spend: number;
  revenue: number;
  status: "ACTIVE" | "PAUSED" | "STOPPED";
}

// ─── Auth ────────────────────────────────────────────
export interface User {
  email: string;
  name: string;
  tier: "sovereign" | "ghost" | "franchise";
}

// ─── Lead ────────────────────────────────────────────
export interface Lead {
  name: string;
  email?: string;
  company?: string;
  stage: "cold" | "warm" | "hot";
  score?: number;
  industry?: string;
}
