/**
 * @sovereign-matrix/agent-sdk — Type Definitions
 *
 * Core interfaces for building custom agents on the Sovereign Matrix platform.
 */

/** Supported LLM providers available through the unified AI router. */
export type ModelProvider = "gemini" | "claude" | "nim" | "ollama" | "groq";

/**
 * Configuration for creating a new agent.
 *
 * @example
 * ```ts
 * const config: AgentConfig = {
 *   name: "research-agent",
 *   description: "Searches the web and synthesizes findings",
 *   model: "gemini",
 *   systemPrompt: "You are a research assistant...",
 *   tools: [searchTool],
 *   guardrails: { blockPII: true, maxInputLength: 4000 },
 * };
 * ```
 */
export interface AgentConfig {
  /** Unique identifier for the agent. Used for registration and retrieval. */
  name: string;
  /** Human-readable description of what the agent does. */
  description: string;
  /** Semantic version string (defaults to "1.0.0"). */
  version?: string;
  /** LLM provider to route requests through. Defaults to "gemini". */
  model?: ModelProvider;
  /** System prompt injected at the start of every conversation turn. */
  systemPrompt?: string;
  /** Tools the agent can invoke during execution. */
  tools?: AgentTool[];
  /** Input validation and safety constraints. */
  guardrails?: GuardrailConfig;
  /** Maximum tokens for the LLM response. */
  maxTokens?: number;
}

/**
 * A tool that an agent can call during execution.
 *
 * Tools follow a name + schema + handler pattern similar to the
 * MCP (Model Context Protocol) tool specification.
 */
export interface AgentTool {
  /** Unique tool name (e.g. "web_search", "database_query"). */
  name: string;
  /** Description shown to the LLM so it knows when to invoke this tool. */
  description: string;
  /** JSON Schema describing the expected input object. */
  inputSchema: Record<string, unknown>;
  /** Async function that executes the tool and returns a string result. */
  handler: (input: Record<string, unknown>) => Promise<string>;
}

/**
 * Safety guardrails applied before the LLM is invoked.
 * All fields are optional — omit any you don't need.
 */
export interface GuardrailConfig {
  /** If set, only inputs matching one of these topics are allowed through. */
  allowedTopics?: string[];
  /** When true, inputs containing detected PII are rejected. */
  blockPII?: boolean;
  /** Maximum character length for the user input. */
  maxInputLength?: number;
}

/** The structured response returned after an agent run. */
export interface AgentResponse {
  /** Whether the agent completed without errors. */
  success: boolean;
  /** The final text output from the LLM. */
  output: string;
  /** Which model provider handled the request. */
  model: string;
  /** Approximate token count consumed by this run. */
  tokensUsed: number;
  /** Wall-clock execution time in milliseconds. */
  duration: number;
  /** Whether input passed all configured guardrail checks. */
  guardrailsPassed: boolean;
}

/**
 * Runtime context passed into every agent invocation.
 *
 * Carries the user's identity, their input, and optional
 * conversational memory or arbitrary metadata.
 */
export interface AgentContext {
  /** Authenticated user ID (e.g. Clerk user ID). */
  userId: string;
  /** The user's natural-language input for this turn. */
  input: string;
  /** Optional serialized memory from previous turns. */
  memory?: string;
  /** Arbitrary key-value metadata forwarded to the LLM and tools. */
  metadata?: Record<string, unknown>;
}
