/** Shared types for the SOVEREIGN platform */

// ─── AI ──────────────────────────────────────────────
export type AIModel =
  | "gemini"
  | "claude"
  | "nim"
  | "ollama"
  | "groq"
  | "deepseek"
  | "mistral"
  | "qwen"
  | "cerebras"
  | "auto";

/**
 * TaskType drives auto-routing to the optimal FREE open-source model.
 * Setting `taskType` overrides `model` and selects from the NIM/Cerebras free tier.
 *
 *   classify   → Cerebras Llama-4 Scout (2000 tok/s, ~300ms)
 *   extract    → Cerebras Llama-4 Scout
 *   route      → Cerebras Llama-4 Scout
 *   summarize  → Nemotron Nano 9B v2 (free, fast)
 *   rewrite    → Nemotron Nano 9B v2
 *   content    → Nemotron Ultra 253B (free, replaces Claude Sonnet for long-form)
 *   sales      → Nemotron Ultra 253B
 *   analysis   → Nemotron Ultra 253B
 *   code       → Qwen3 Coder 30B Instruct (free, code-specialist)
 *   reason     → DeepSeek V3.2 671B MoE (free, frontier reasoning, replaces Claude Opus thinking)
 *   plan       → Nemotron 3 Super 120B (1M context, agentic planning)
 *   creative   → Llama 4 Maverick 17B-128e (multimodal, expressive)
 *   vision     → Qwen 3.5 VLM 400B
 *   safety     → Nemotron Content Safety 4B
 *   embed      → NV-EmbedQA 1B (free embeddings)
 */
export type TaskType =
  | "classify"
  | "extract"
  | "route"
  | "summarize"
  | "rewrite"
  | "content"
  | "sales"
  | "analysis"
  | "code"
  | "reason"
  | "plan"
  | "creative"
  | "vision"
  | "safety"
  | "embed";

export interface AIOptions {
  model?: AIModel;
  system?: string;
  taskType?: TaskType;
  maxTokens?: number;
  /** Enable Claude Extended Thinking for deep reasoning tasks (paid; rarely needed — prefer taskType:"reason" → DeepSeek V3.2 free) */
  thinking?: boolean;
  /** Use Claude Opus 4.6 for maximum reasoning (paid; rarely needed — prefer taskType:"reason") */
  useOpus?: boolean;
  /** Use Gemini 2.5 Pro instead of Flash (available on Google AI Ultra plan) */
  useGeminiPro?: boolean;
  /** Per-call temperature override (default 0.4 for classify/extract, 0.6 for content/creative) */
  temperature?: number;
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
