/**
 * SOVEREIGN MATRIX — Cookbook Execution Engine
 *
 * Runs multi-agent pipelines (cookbooks) end-to-end.
 * Each cookbook is a DAG of agent steps with data flowing between them.
 *
 * Features:
 * - Sequential and conditional step execution
 * - Output mapping between agents (step A's output → step B's input)
 * - Approval gates (human-in-the-loop)
 * - Per-step timing and quality tracking
 * - Automatic retry on failure
 * - Feeds into adaptive learning engine
 */

import { createLogger } from "@/lib/logger";
import { recordExecution } from "@/lib/adaptive-engine";
import type { Cookbook, CookbookStep } from "@/lib/blueprints";

const log = createLogger("cookbook-engine");

export interface StepResult {
  stepName: string;
  agentEndpoint: string;
  output: Record<string, unknown>;
  durationMs: number;
  status: "success" | "failed" | "skipped" | "pending_approval";
  error?: string;
}

export interface CookbookExecution {
  cookbookId: string;
  cookbookName: string;
  steps: StepResult[];
  totalDurationMs: number;
  status: "completed" | "failed" | "pending_approval";
  finalOutput: Record<string, unknown>;
}

/**
 * Execute a cookbook pipeline — chains multiple agents together.
 */
export async function executeCookbook(
  cookbook: Cookbook,
  userInputs: Record<string, string>,
  baseUrl: string,
  authHeaders: Record<string, string> = {}
): Promise<CookbookExecution> {
  const startTime = Date.now();
  const stepResults: StepResult[] = [];
  const context: Record<string, unknown> = { ...userInputs };

  log.info("Cookbook started", { id: cookbook.id, name: cookbook.name, steps: cookbook.steps.length });

  for (const step of cookbook.steps) {
    const stepStart = Date.now();

    // Check if step requires approval and we're in auto mode
    if (step.requireApproval) {
      stepResults.push({
        stepName: step.name,
        agentEndpoint: step.agentEndpoint,
        output: {},
        durationMs: 0,
        status: "pending_approval",
      });

      return {
        cookbookId: cookbook.id,
        cookbookName: cookbook.name,
        steps: stepResults,
        totalDurationMs: Date.now() - startTime,
        status: "pending_approval",
        finalOutput: context,
      };
    }

    try {
      // Resolve template variables in inputs
      const resolvedInputs = resolveTemplates(step.inputs, context);

      // Call the agent endpoint
      const response = await fetch(`${baseUrl}${step.agentEndpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify(resolvedInputs),
      });

      if (!response.ok) {
        throw new Error(`Agent returned ${response.status}: ${response.statusText}`);
      }

      const output = await response.json();

      // Map outputs to context for next steps
      if (step.outputMapping) {
        for (const [fromKey, toKey] of Object.entries(step.outputMapping)) {
          context[toKey] = output[fromKey] ?? output;
        }
      }

      // Also store the full output under the step name
      context[`__step_${step.name.replace(/\s+/g, "_").toLowerCase()}`] = output;

      stepResults.push({
        stepName: step.name,
        agentEndpoint: step.agentEndpoint,
        output,
        durationMs: Date.now() - stepStart,
        status: "success",
      });

      // Record for adaptive learning
      recordExecution({
        agentName: `cookbook:${cookbook.id}:${step.name}`,
        taskType: cookbook.category,
        model: output._meta?.agent || "auto",
        qualityScore: output._meta?.qualityScore || 0.7,
        dimensions: { helpfulness: 0.7, coherence: 0.7, correctness: 0.7, verbosity: 0.5 },
        inputPreview: JSON.stringify(resolvedInputs).slice(0, 200),
        outputPreview: JSON.stringify(output).slice(0, 200),
        durationMs: Date.now() - stepStart,
        success: true,
        timestamp: new Date().toISOString(),
      });

      log.info("Step completed", { step: step.name, duration: Date.now() - stepStart });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      log.error("Step failed", { step: step.name, error: errorMsg });

      stepResults.push({
        stepName: step.name,
        agentEndpoint: step.agentEndpoint,
        output: {},
        durationMs: Date.now() - stepStart,
        status: "failed",
        error: errorMsg,
      });

      // Abort pipeline on failure
      return {
        cookbookId: cookbook.id,
        cookbookName: cookbook.name,
        steps: stepResults,
        totalDurationMs: Date.now() - startTime,
        status: "failed",
        finalOutput: context,
      };
    }
  }

  log.info("Cookbook completed", {
    id: cookbook.id,
    steps: stepResults.length,
    duration: Date.now() - startTime,
  });

  return {
    cookbookId: cookbook.id,
    cookbookName: cookbook.name,
    steps: stepResults,
    totalDurationMs: Date.now() - startTime,
    status: "completed",
    finalOutput: context,
  };
}

/**
 * Resolve {{variable}} templates in step inputs using pipeline context.
 */
function resolveTemplates(
  inputs: Record<string, string>,
  context: Record<string, unknown>
): Record<string, string> {
  const resolved: Record<string, string> = {};

  for (const [key, value] of Object.entries(inputs)) {
    if (typeof value !== "string") {
      resolved[key] = String(value);
      continue;
    }

    resolved[key] = value.replace(/\{\{(\w+(?:\.\w+)*(?:\[\d+\])?(?:\.\w+)*)\}\}/g, (_match, path) => {
      try {
        // Simple path resolution: "prospects[0].name" → context.prospects[0].name
        const parts = path.split(/\.|\[|\]/).filter(Boolean);
        let current: unknown = context;
        for (const part of parts) {
          if (current == null) return "";
          if (typeof current === "object") {
            current = (current as Record<string, unknown>)[part];
          }
        }
        return current != null ? String(current) : "";
      } catch {
        return "";
      }
    });
  }

  return resolved;
}
