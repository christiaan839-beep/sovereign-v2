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
  | "qwen";
/**
 * TaskType — drives router decisions in src/lib/ai.ts
 *
 * Generic categories (legacy): content, analysis, sales
 * Routing-aware categories (cost/latency optimized):
 *   - classify | extract | json → fast structured output → Cerebras (Llama 3.3)
 *   - code → Groq Qwen 2.5 Coder
 *   - reasoning → NIM Nemotron Ultra (then Claude Sonnet w/o thinking)
 *   - creative | longform → Gemini Pro / Claude Sonnet
 */
export type TaskType =
  | "content"
  | "analysis"
  | "code"
  | "sales"
  | "classify"
  | "extract"
  | "json"
  | "creative"
  | "longform"
  | "reasoning";

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
