/**
 * SOVEREIGN MATRIX — Super-Agent (Cook 36 / Tier 1 #1)
 *
 * Multi-turn tool-use loop on top of the existing `ai()` router.
 * Joins `runSuperAgent` (one-shot, Cook 33) as the second canonical
 * entry point for agent execution.
 *
 * Loop contract:
 *   1. Inject the registry's tool-list block into the system prompt.
 *   2. Each step parses the model's envelope, dispatches tool calls
 *      in PARALLEL via `Promise.all`, feeds results back as the next
 *      user turn.
 *   3. Hard `maxSteps` cap (default 5) catches infinite loops.
 *   4. Three outcomes: `answer` (final commit), `max-steps` (loop
 *      cap hit), `no-tool-call-parse` (model fell off the rails;
 *      raw output passed through to caller).
 *
 * Every step's `modelOutput + toolCalls + toolResults` is preserved
 * in `steps[]` for receipt embedding.
 */

import {
  parseToolCallOutput,
  type ToolCallResult,
  type ToolContext,
  type ToolRegistry,
} from "@/lib/tool-registry";

export interface ToolAgentSpec {
  agentSlug: string;
  /** System prompt minus the tool-list block — the loop appends that. */
  systemPrompt: string;
  registry: ToolRegistry;
  toolContext: ToolContext;
  /** Loop cap. Default 5. */
  maxSteps?: number;
  /** Optional override of the underlying AI model. Defaults to the router default. */
  model?: import("@/types").AIModel;
}

export interface ToolAgentStep {
  modelOutput: string;
  toolCalls: Array<{ name: string; args: unknown }>;
  toolResults: ToolCallResult[];
}

export interface ToolAgentResult {
  outcome: "answer" | "max-steps" | "no-tool-call-parse";
  finalAnswer: string;
  steps: ToolAgentStep[];
}

const DEFAULT_MAX_STEPS = 5;

/**
 * Run a tool-using agent over multiple turns. Each step parses the
 * model's envelope, dispatches tool calls in parallel, and feeds
 * results back as the next user turn. Terminates on:
 *   - finalAnswer present + empty toolCalls   → "answer"
 *   - maxSteps reached                        → "max-steps"
 *   - model output isn't a parseable envelope → "no-tool-call-parse"
 */
export async function runWithTools(
  userPrompt: string,
  spec: ToolAgentSpec,
): Promise<ToolAgentResult> {
  // Lazy import keeps the static graph free of Clerk/db/SDK imports
  // until a tool-using agent actually runs — preserves bundle size
  // for the edge runtime and isolates the failure surface in tests.
  const { ai } = await import("./ai");

  const maxSteps = spec.maxSteps ?? DEFAULT_MAX_STEPS;
  const systemPrompt = `${spec.systemPrompt}\n\n${spec.registry.describeForModel()}`;
  const steps: ToolAgentStep[] = [];

  // Build the conversation as a single rolling prompt — `ai()` is
  // stateless, so we serialize history into the user turn each step.
  const history: string[] = [`USER: ${userPrompt}`];

  for (let i = 0; i < maxSteps; i++) {
    const turn = history.join("\n\n");
    const modelOutput = await ai(turn, {
      system: systemPrompt,
      model: spec.model,
    });

    const envelope = parseToolCallOutput(modelOutput);

    if (!envelope) {
      steps.push({ modelOutput, toolCalls: [], toolResults: [] });
      return {
        outcome: "no-tool-call-parse",
        finalAnswer: modelOutput,
        steps,
      };
    }

    // Terminal turn: model committed to a final answer with no tool
    // calls pending. Capture and exit.
    if (envelope.toolCalls.length === 0) {
      steps.push({
        modelOutput,
        toolCalls: [],
        toolResults: [],
      });
      return {
        outcome: "answer",
        finalAnswer: envelope.finalAnswer ?? "",
        steps,
      };
    }

    // Non-terminal: dispatch tool calls in PARALLEL. A model emitting
    // 5 tool calls in one step costs the wall-clock of the slowest
    // call, not the sum.
    const toolResults = await Promise.all(
      envelope.toolCalls.map((tc) =>
        spec.registry.call(tc.name, tc.args, spec.toolContext),
      ),
    );

    steps.push({
      modelOutput,
      toolCalls: envelope.toolCalls,
      toolResults,
    });

    // Feed results back as the next user turn so the model can react.
    history.push(`ASSISTANT: ${modelOutput}`);
    history.push(`TOOL_RESULTS: ${JSON.stringify(toolResults)}`);
  }

  return { outcome: "max-steps", finalAnswer: "", steps };
}
