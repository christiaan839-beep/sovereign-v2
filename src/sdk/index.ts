/**
 * @sovereign-matrix/agent-sdk
 *
 * Build custom AI agents that plug into the Sovereign Matrix platform.
 * This SDK handles model routing, guardrail enforcement, tool execution,
 * and agent lifecycle management so you can focus on your agent's logic.
 *
 * @example
 * ```ts
 * import { createAgent } from "@/sdk";
 *
 * const agent = createAgent({
 *   name: "my-agent",
 *   description: "Does something useful",
 *   model: "gemini",
 *   systemPrompt: "You are a helpful assistant.",
 * });
 *
 * const result = await agent.run({
 *   userId: "user_123",
 *   input: "Summarize the latest news",
 * });
 * ```
 *
 * @packageDocumentation
 */

import type {
  AgentConfig,
  AgentContext,
  AgentResponse,
  AgentTool,
  GuardrailConfig,
} from "./types";

export type {
  AgentConfig,
  AgentContext,
  AgentResponse,
  AgentTool,
  GuardrailConfig,
};

// ---------------------------------------------------------------------------
// Internal registry
// ---------------------------------------------------------------------------

const agentRegistry = new Map<string, AgentConfig>();

// ---------------------------------------------------------------------------
// Guardrail helpers
// ---------------------------------------------------------------------------

/** Simple PII detection — catches emails, phone numbers, and SSN patterns. */
function containsPII(text: string): boolean {
  const patterns = [
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // email
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // phone
    /\b\d{3}[-]?\d{2}[-]?\d{4}\b/, // SSN
  ];
  return patterns.some((p) => p.test(text));
}

/** Run all configured guardrail checks against the input. */
function checkGuardrails(
  input: string,
  guardrails: GuardrailConfig | undefined,
): { passed: boolean; reason?: string } {
  if (!guardrails) return { passed: true };

  if (
    guardrails.maxInputLength &&
    input.length > guardrails.maxInputLength
  ) {
    return {
      passed: false,
      reason: `Input exceeds maximum length of ${guardrails.maxInputLength} characters`,
    };
  }

  if (guardrails.blockPII && containsPII(input)) {
    return {
      passed: false,
      reason: "Input contains personally identifiable information",
    };
  }

  if (guardrails.allowedTopics && guardrails.allowedTopics.length > 0) {
    const lower = input.toLowerCase();
    const matched = guardrails.allowedTopics.some((topic) =>
      lower.includes(topic.toLowerCase()),
    );
    if (!matched) {
      return {
        passed: false,
        reason: `Input does not match any allowed topics: ${guardrails.allowedTopics.join(", ")}`,
      };
    }
  }

  return { passed: true };
}

// ---------------------------------------------------------------------------
// AI routing — thin wrapper that imports the platform's unified router
// ---------------------------------------------------------------------------

async function callModel(
  prompt: string,
  config: AgentConfig,
): Promise<{ output: string; tokensUsed: number }> {
  try {
    // In production this delegates to the platform's unified AI router
    // (src/lib/ai.ts) which handles key resolution, fallback, and billing.
    const { ai } = await import("@/lib/ai");
    const output = await ai(prompt, {
      model: config.model ?? "gemini",
      maxTokens: config.maxTokens,
    });
    // Token count is an estimate — the router doesn't expose it directly yet.
    const tokensUsed = Math.ceil(output.length / 4);
    return { output, tokensUsed };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown model error";
    throw new Error(`Model invocation failed: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create and register a new agent.
 *
 * Returns an object with a `run` method you can call to execute the agent
 * against a user context. The agent is also stored in the internal registry
 * so it can be retrieved later via {@link getAgent} or {@link listAgents}.
 *
 * @param config - The agent's configuration (name, model, tools, etc.)
 * @returns An agent instance with a `run(context)` method.
 *
 * @example
 * ```ts
 * const agent = createAgent({
 *   name: "code-reviewer",
 *   description: "Reviews pull requests for style and bugs",
 *   model: "claude",
 *   systemPrompt: "You are an expert code reviewer...",
 *   guardrails: { maxInputLength: 8000 },
 * });
 *
 * const result = await agent.run({
 *   userId: "user_abc",
 *   input: codeSnippet,
 * });
 *
 * console.log(result.output);
 * ```
 */
export function createAgent(config: AgentConfig) {
  // Validate required fields
  if (!config.name?.trim()) {
    throw new Error("Agent name is required");
  }
  if (!config.description?.trim()) {
    throw new Error("Agent description is required");
  }

  // Apply defaults
  const resolved: AgentConfig = {
    version: "1.0.0",
    model: "gemini",
    ...config,
  };

  // Register
  agentRegistry.set(resolved.name, resolved);

  return {
    /** The resolved agent configuration. */
    config: resolved,

    /**
     * Execute the agent with the given context.
     *
     * The pipeline: validate input -> enforce guardrails -> build prompt
     * (system + memory + tools + user input) -> call LLM -> return response.
     */
    async run(context: AgentContext): Promise<AgentResponse> {
      const start = performance.now();

      // --- Guardrails ---
      const guardrailResult = checkGuardrails(
        context.input,
        resolved.guardrails,
      );
      if (!guardrailResult.passed) {
        return {
          success: false,
          output: `Guardrail blocked: ${guardrailResult.reason}`,
          model: resolved.model ?? "gemini",
          tokensUsed: 0,
          duration: performance.now() - start,
          guardrailsPassed: false,
        };
      }

      // --- Build prompt ---
      const parts: string[] = [];

      if (resolved.systemPrompt) {
        parts.push(resolved.systemPrompt);
      }

      if (context.memory) {
        parts.push(`<memory>\n${context.memory}\n</memory>`);
      }

      if (resolved.tools && resolved.tools.length > 0) {
        const toolDescriptions = resolved.tools
          .map(
            (t) =>
              `- ${t.name}: ${t.description} (schema: ${JSON.stringify(t.inputSchema)})`,
          )
          .join("\n");
        parts.push(
          `<available_tools>\n${toolDescriptions}\n</available_tools>`,
        );
      }

      if (context.metadata) {
        parts.push(
          `<metadata>\n${JSON.stringify(context.metadata, null, 2)}\n</metadata>`,
        );
      }

      parts.push(context.input);

      const fullPrompt = parts.join("\n\n");

      // --- Call model ---
      try {
        const { output, tokensUsed } = await callModel(
          fullPrompt,
          resolved,
        );

        return {
          success: true,
          output,
          model: resolved.model ?? "gemini",
          tokensUsed,
          duration: performance.now() - start,
          guardrailsPassed: true,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Execution failed";
        return {
          success: false,
          output: message,
          model: resolved.model ?? "gemini",
          tokensUsed: 0,
          duration: performance.now() - start,
          guardrailsPassed: true,
        };
      }
    },
  };
}

/**
 * List all agents that have been registered via {@link createAgent}.
 *
 * @returns An array of `AgentConfig` objects currently in the registry.
 */
export function listAgents(): AgentConfig[] {
  return Array.from(agentRegistry.values());
}

/**
 * Retrieve a registered agent's config by name.
 *
 * @param name - The unique name the agent was registered with.
 * @returns The `AgentConfig`, or `undefined` if no agent with that name exists.
 */
export function getAgent(name: string): AgentConfig | undefined {
  return agentRegistry.get(name);
}
