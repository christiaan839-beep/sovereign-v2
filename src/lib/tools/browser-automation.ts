/**
 * SOVEREIGN MATRIX — Browser automation tool (Cook 61 / Tier 2 #8)
 *
 * Productizes the existing `computer-use` agent as a Tier-3 tool
 * usable by any agent in the registry. The runner is dependency-
 * injected (Playwright, Browserbase, etc.) so production wires one
 * and tests inject a mock.
 *
 * Contract:
 *
 *   - URL gating reuses the SSRF guard from `tools/built-in.ts`
 *     (private nets / metadata / loopback blocked).
 *   - Typed action grammar: `navigate`, `click`, `type`, `screenshot`,
 *     `wait`, `evaluate`. The grammar is closed — model emissions
 *     outside it are schema-rejected before any browser code runs.
 *   - Action list capped at MAX_ACTIONS (30) per dispatch — runaway
 *     prompts can't drive a 1000-step browser session.
 *   - Step timeout caller-supplied, hard-capped at 30s per step.
 *   - Output truncated like the sandbox tool (Cook 54) so screenshot
 *     base64 blobs don't blow up the model's context window.
 */

import { z } from "zod";
import type { ToolDefinition } from "@/lib/tool-registry";
import { isSafeUrl } from "@/lib/tools/built-in";

// ── Public types ──────────────────────────────────────────────────────────

export type BrowserActionInput =
  | { kind: "navigate"; url: string }
  | { kind: "click"; selector: string }
  | { kind: "type"; selector: string; text: string }
  | { kind: "screenshot" }
  | { kind: "wait"; selector?: string; ms?: number }
  | { kind: "evaluate"; expression: string };

export interface BrowserStepResult {
  /** Action kind that was performed. */
  kind: BrowserActionInput["kind"];
  ok: boolean;
  /** Free-form result — selector text, URL, base64 screenshot, etc. */
  result?: string;
  /** Error message when ok=false. */
  error?: string;
  /** Step wall-clock in ms. */
  durationMs: number;
}

export interface BrowserSessionResult {
  steps: BrowserStepResult[];
  finalUrl: string | null;
  /** True if any step failed. */
  partialFailure: boolean;
}

export type BrowserRunner = (
  actions: BrowserActionInput[],
  options: { perStepTimeoutMs: number },
) => Promise<BrowserSessionResult>;

// ── Constants ─────────────────────────────────────────────────────────────

const MAX_ACTIONS = 30;
const DEFAULT_STEP_TIMEOUT_MS = 8_000;
const MAX_STEP_TIMEOUT_MS = 30_000;
const SCREENSHOT_MAX_BYTES = 200_000;

// ── Action schemas ────────────────────────────────────────────────────────

const ACTION_NAVIGATE = z.object({
  kind: z.literal("navigate"),
  url: z.string().url().refine(isSafeUrl, {
    message:
      "URL blocked by SSRF guard (private net / metadata / loopback / non-https)",
  }),
});

const ACTION_CLICK = z.object({
  kind: z.literal("click"),
  selector: z.string().min(1).max(500),
});

const ACTION_TYPE = z.object({
  kind: z.literal("type"),
  selector: z.string().min(1).max(500),
  text: z.string().max(5_000),
});

const ACTION_SCREENSHOT = z.object({ kind: z.literal("screenshot") });

const ACTION_WAIT = z.object({
  kind: z.literal("wait"),
  selector: z.string().min(1).max(500).optional(),
  ms: z.number().int().min(0).max(MAX_STEP_TIMEOUT_MS).optional(),
});

const ACTION_EVALUATE = z.object({
  kind: z.literal("evaluate"),
  expression: z.string().min(1).max(2_000),
});

const ACTION = z.discriminatedUnion("kind", [
  ACTION_NAVIGATE,
  ACTION_CLICK,
  ACTION_TYPE,
  ACTION_SCREENSHOT,
  ACTION_WAIT,
  ACTION_EVALUATE,
]);

const SESSION_INPUT = z.object({
  actions: z.array(ACTION).min(1).max(MAX_ACTIONS),
  perStepTimeoutMs: z
    .number()
    .int()
    .min(100)
    .max(MAX_STEP_TIMEOUT_MS)
    .optional(),
  /** Required literal to force model to be explicit about the side effect. */
  confirmBrowserUse: z.literal("I CONFIRM BROWSER AUTOMATION"),
});

// ── Output truncation ─────────────────────────────────────────────────────

/**
 * Truncate the `result` field for any screenshot step so the model
 * doesn't burn its context window. Marks the truncation explicitly.
 */
export function truncateStepResult(
  step: BrowserStepResult,
  max = SCREENSHOT_MAX_BYTES,
): BrowserStepResult {
  if (!step.result || step.kind !== "screenshot") return step;
  if (step.result.length <= max) return step;
  return {
    ...step,
    result:
      step.result.slice(0, max) +
      `\n…[truncated ${step.result.length - max} bytes]`,
  };
}

// ── Tool factory ──────────────────────────────────────────────────────────

interface ToolOutput {
  ok: boolean;
  steps: BrowserStepResult[];
  finalUrl: string | null;
  /** True when every step succeeded. */
  allSuccess: boolean;
}

export function buildBrowserAutomationTool(
  runner: BrowserRunner,
): ToolDefinition<z.infer<typeof SESSION_INPUT>, ToolOutput> {
  return {
    name: "browser_session",
    description:
      "Drive a headless browser through up to 30 typed actions (navigate / click / type / screenshot / wait / evaluate). HTTPS-only, SSRF-guarded, 30s per-step cap. Admin-only (Tier 3).",
    inputSchema: SESSION_INPUT,
    tier: 3,
    execute: async (input) => {
      const result = await runner(input.actions as BrowserActionInput[], {
        perStepTimeoutMs: input.perStepTimeoutMs ?? DEFAULT_STEP_TIMEOUT_MS,
      });
      const steps = result.steps.map((s) => truncateStepResult(s));
      const allSuccess = steps.every((s) => s.ok);
      return {
        ok: allSuccess,
        steps,
        finalUrl: result.finalUrl,
        allSuccess,
      };
    },
  };
}

export const BROWSER_CONSTANTS = {
  MAX_ACTIONS,
  DEFAULT_STEP_TIMEOUT_MS,
  MAX_STEP_TIMEOUT_MS,
  SCREENSHOT_MAX_BYTES,
};
