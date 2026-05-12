/**
 * Super Agent — elite-stack composition helper.
 *
 * Wires the two Cook-32 super-agent primitives (confidence-gate and
 * expert-critic) into a single invocation. Every Cook-33+ entry-level
 * agent calls `runSuperAgent()` instead of the raw AI router so it
 * inherits the full elite reliability stack by default:
 *
 *   1. Generate (with the agent's own system prompt)
 *   2. Confidence gate (commit / escalate / abstain)
 *   3. Expert critic (domain-rubric-based final pass)
 *   4. Structured, receipt-friendly envelope
 *
 * The factory's existing `verifyOutput()` pipeline (LlamaGuard + PII +
 * content policy + quality + trust) wraps this as the OUTER layer when
 * the route is registered via `createAgentRoute({ useVerifier: true })`.
 * Together: 6 independent safety checks. No single failure can ship a
 * wrong answer.
 *
 * Why a separate helper, not just inline calls in each agent route:
 *   - One contract → one bug surface. If the composition order changes
 *     (e.g., we add a new step), every agent benefits without
 *     individual edits.
 *   - The receipt envelope is canonical — receipts from any super-agent
 *     have an identical schema, so the verifier + replay endpoint can
 *     consume them uniformly.
 *   - Tests on this helper exercise the composition logic once, not
 *     N times across N agent routes.
 */

import { confidenceGate, type ConfidenceTier } from "./confidence-gate";
import { expertReview, type ExpertVerdict } from "./expert-critic";
import {
  type ToolCallResult,
  type ToolContext,
  type ToolRegistry,
  parseToolCallOutput,
} from "./tool-registry";
import { createLogger } from "./logger";

// `ai` is lazy-imported inside `runWithTools` to keep this module's
// static import graph free of Clerk + db + provider SDKs. That way
// any test that imports super-agent.ts (e.g., the Cook 33 super-agent
// suite) doesn't have to mock `./ai` AND every transitive Clerk /
// db / SDK module — vitest cleanly imports super-agent.ts and only
// pays the heavy-deps cost when a caller actually invokes the
// tool-use loop.

const log = createLogger("super-agent");

/** Per-agent configuration of the elite stack. */
export interface SuperAgentSpec {
  /** Slug for telemetry and debugging. Matches the API route segment. */
  agentSlug: string;
  /** Domain-anchored system prompt the model sees. */
  systemPrompt: string;
  /**
   * Confidence tier (or numeric threshold). Picked per agent based on
   * stakes: marketing copy = "permissive", customer-facing replies =
   * "standard", legal/compliance = "strict", medical = "critical".
   */
  confidenceTier: ConfidenceTier | number;
  /**
   * Expert-critic rubric id. Use `"generic-audit-ready"` when no
   * domain-specific rubric exists; null to skip the critic entirely
   * (only appropriate for non-customer-facing internal helpers).
   */
  rubricId: string | null;
  /** Max output tokens. Default 2000. */
  maxTokens?: number;
}

/** Final committed answer. Shipped to the user, signed in the receipt. */
export interface SuperAgentCommit {
  outcome: "commit";
  answer: string;
  /** Self-reported confidence (0-1) at the gate layer. */
  confidence: number;
  /** Whether the gate escalated to verified-AI consensus. */
  escalated: boolean;
  /**
   * Critic verdict (null when the agent has rubricId=null and skipped
   * the critic). When present, `pass` is always true here — failed
   * verdicts route to the `revise` outcome instead.
   */
  critic: ExpertVerdict | null;
}

/** Critic flagged issues; the agent is asking for a revision. */
export interface SuperAgentRevise {
  outcome: "revise";
  /** The candidate answer the critic flagged. Useful as a draft. */
  candidate: string;
  /** Critic's structured verdict. `pass` is false here by definition. */
  critic: ExpertVerdict;
  /** Concrete prompt the caller (or a retry layer) can use to regenerate. */
  revisionPrompt: string;
}

/** The agent declined to ship anything. Route to a human. */
export interface SuperAgentAbstain {
  outcome: "abstain";
  /**
   * The model's last attempt, kept for the human reviewer's context.
   * NEVER show this to end users — it's the whole point of abstaining.
   */
  draft: string;
  reason: string;
  confidence: number;
}

export type SuperAgentResult =
  | SuperAgentCommit
  | SuperAgentRevise
  | SuperAgentAbstain;

/**
 * Run a prompt through the full super-agent stack.
 *
 * Always returns a structured `SuperAgentResult` — never throws.
 * Network failures upstream of the gate degrade to abstain. Critic
 * failures degrade to abstain (per the critic's own defensive
 * default — see `expertReview`).
 *
 * Receipt-friendly: every field is JSON-safe (no Date, no functions,
 * no undefined). The result can be embedded directly in an agent
 * receipt for /api/verify replayability.
 */
export async function runSuperAgent(
  userPrompt: string,
  spec: SuperAgentSpec,
): Promise<SuperAgentResult> {
  const { agentSlug, systemPrompt, confidenceTier, rubricId, maxTokens } = spec;

  // ── Layer 1+2: Generate + confidence-gate ──────────────
  const gated = await confidenceGate(userPrompt, {
    system: systemPrompt,
    threshold: confidenceTier,
    maxTokens,
    abstainOnNetworkError: true,
  });

  if (gated.action === "abstain") {
    log.info("super-agent abstained at the gate", {
      agentSlug,
      confidence: gated.confidence,
      threshold: gated.threshold,
    });
    return {
      outcome: "abstain",
      draft: gated.answer,
      reason: gated.reason,
      confidence: gated.confidence,
    };
  }

  // The confidence gate already escalated internally if it needed to;
  // we don't distinguish commit-direct from commit-after-escalation
  // here, but `escalated` is preserved on the result so the receipt
  // can record it.
  const candidate = gated.answer;

  // ── Layer 3: Expert critic (skipped when rubricId is null) ────
  if (rubricId === null) {
    return {
      outcome: "commit",
      answer: candidate,
      confidence: gated.confidence,
      escalated: gated.escalated,
      critic: null,
    };
  }

  const critic = await expertReview(candidate, rubricId);

  if (!critic.pass) {
    log.info("super-agent revise — critic flagged issues", {
      agentSlug,
      worstSeverity: critic.worstSeverity,
      findingCount: critic.findings.length,
    });
    return {
      outcome: "revise",
      candidate,
      critic,
      revisionPrompt:
        critic.revisionPrompt ||
        `Revise the candidate to address: ${critic.findings.map((f) => f.detail).join("; ")}`,
    };
  }

  return {
    outcome: "commit",
    answer: candidate,
    confidence: gated.confidence,
    escalated: gated.escalated,
    critic,
  };
}

/**
 * Lightweight "is this result safe to ship to the user?" check.
 * Pure function — exported so route handlers can branch consistently
 * without re-implementing the discriminated-union narrowing.
 */
export function isShippable(
  result: SuperAgentResult,
): result is SuperAgentCommit {
  return result.outcome === "commit";
}

/**
 * Build the customer-facing response envelope from a super-agent
 * result. Centralizes how the three outcomes serialize so every
 * agent route returns the same shape.
 *
 * `commit`:  { ok: true, answer, confidence, escalated, critic }
 * `revise`:  { ok: false, code: "REVISE_REQUIRED", critique: {...} }
 * `abstain`: { ok: false, code: "HUMAN_REVIEW_REQUIRED", reason }
 */
export function toResponseEnvelope(
  result: SuperAgentResult,
): Record<string, unknown> {
  if (result.outcome === "commit") {
    return {
      ok: true,
      answer: result.answer,
      confidence: result.confidence,
      escalated: result.escalated,
      critic: result.critic
        ? {
            pass: result.critic.pass,
            rubricId: result.critic.rubricId,
            findings: result.critic.findings,
          }
        : null,
    };
  }
  if (result.outcome === "revise") {
    return {
      ok: false,
      code: "REVISE_REQUIRED",
      critique: {
        worstSeverity: result.critic.worstSeverity,
        findings: result.critic.findings,
        revisionPrompt: result.revisionPrompt,
        rubricId: result.critic.rubricId,
      },
    };
  }
  // abstain
  return {
    ok: false,
    code: "HUMAN_REVIEW_REQUIRED",
    reason: result.reason,
    confidence: result.confidence,
  };
}

// ─────────────────────────────────────────────────────────────────
// Cook 36: Tool-use loop
// ─────────────────────────────────────────────────────────────────

/**
 * One step in the tool-call loop. Each step the model either emits
 * tool calls (we dispatch + feed the results back as a new user
 * turn) or a final answer (we exit the loop).
 *
 * Receipt-relevant: every step's tool calls + results are recorded
 * in `toolHistory` so the receipt captures the FULL chain of
 * decisions, not just the final answer.
 */
export interface ToolStep {
  /** The model's raw output for this step. */
  modelOutput: string;
  /** Tool calls the model emitted on this step. */
  toolCalls: Array<{ name: string; args: Record<string, unknown> }>;
  /** Dispatch results, in the same order as `toolCalls`. */
  toolResults: ToolCallResult[];
}

export interface ToolAgentSpec {
  /** Slug for telemetry. */
  agentSlug: string;
  /** Base system prompt; tool-list block appended automatically. */
  systemPrompt: string;
  /** The registry to dispatch against. */
  registry: ToolRegistry;
  /** Identity context for tool dispatches. */
  toolContext: ToolContext;
  /** Hard cap on iterations to prevent runaway loops. Default 5. */
  maxSteps?: number;
  /** Hard cap on output tokens per step. Default 2000. */
  maxTokens?: number;
}

export interface ToolAgentResult {
  outcome: "answer" | "max-steps" | "no-tool-call-parse";
  /** The final answer the model converged on (empty on max-steps). */
  finalAnswer: string;
  /** Every step the agent took. */
  steps: ToolStep[];
}

/**
 * Tool-use loop. Distinct from `runSuperAgent` because tool use
 * needs multi-turn dialogue with the model, while the super-agent
 * stack is one-shot. Future Cook 37 (orchestration) can compose
 * BOTH: confidence-gate first, then tool-use, then expert-critic.
 *
 * Contracts:
 *   - Always returns a structured result. Never throws.
 *   - `maxSteps` cap is hard — runaway models are caught.
 *   - Every tool call goes through the registry's validation +
 *     three-tier approval, so tier-3 / requires-confirmation
 *     outcomes propagate up to the caller via `toolHistory`.
 */
export async function runWithTools(
  userPrompt: string,
  spec: ToolAgentSpec,
): Promise<ToolAgentResult> {
  const {
    agentSlug,
    systemPrompt,
    registry,
    toolContext,
    maxSteps = 5,
    maxTokens = 2000,
  } = spec;

  const toolListBlock = registry.describeForModel();
  const fullSystem = [
    systemPrompt,
    "",
    "─── TOOL USE ───",
    toolListBlock,
    "",
    'When you want to act, emit ONLY a JSON object: {"toolCalls":[{"name":"tool_name","args":{...}}]}. When you have the final answer, emit {"toolCalls":[],"finalAnswer":"…"}. No markdown fences, no preamble.',
  ].join("\n");

  const transcript: string[] = [`USER: ${userPrompt}`];
  const steps: ToolStep[] = [];

  // Lazy import — see the comment at the top of this file for
  // why ai() isn't a static import.
  const { ai } = await import("./ai");

  for (let stepIdx = 0; stepIdx < maxSteps; stepIdx++) {
    const stepPrompt = transcript.join("\n\n");
    const raw = await ai(stepPrompt, { system: fullSystem, maxTokens });
    const parsed = parseToolCallOutput(raw);

    if (parsed === null) {
      log.warn(
        "Tool agent could not parse model output as tool-call envelope",
        {
          agentSlug,
          step: stepIdx,
        },
      );
      return {
        outcome: "no-tool-call-parse",
        finalAnswer: raw, // give caller the raw model output as a fallback
        steps,
      };
    }

    // Terminal turn: model declared a final answer.
    if (parsed.toolCalls.length === 0) {
      steps.push({ modelOutput: raw, toolCalls: [], toolResults: [] });
      return {
        outcome: "answer",
        finalAnswer: parsed.finalAnswer ?? "",
        steps,
      };
    }

    // Dispatch every tool call in parallel and gather results.
    const toolResults = await Promise.all(
      parsed.toolCalls.map((c) => registry.call(c.name, c.args, toolContext)),
    );
    steps.push({
      modelOutput: raw,
      toolCalls: parsed.toolCalls,
      toolResults,
    });

    // Feed results back into the next user turn.
    transcript.push(`ASSISTANT: ${raw}`);
    transcript.push(`TOOL_RESULTS: ${JSON.stringify(toolResults)}`);
  }

  return {
    outcome: "max-steps",
    finalAnswer: "",
    steps,
  };
}
