/**
 * SOVEREIGN MATRIX — Tool Registry (Cook 36 / Tier 1 #1)
 *
 * Typed function-calling layer that turns describe-only agents into
 * act-capable ones. Every Cook 33-34 agent can call typed functions
 * with three-tier approval, dispatched through a receipt-friendly
 * registry.
 *
 * Three contracts that make it elite-grade:
 *
 *   1. TYPED INPUTS — every tool declares a Zod schema; args are
 *      validated before `execute()` is called. Schema errors return a
 *      structured outcome the model can recover from on the next turn.
 *
 *   2. THREE-TIER APPROVAL — reuses `ActionTier`:
 *        Tier 1 = autonomous, runs immediately
 *        Tier 2 = needs `approvalToken` (or returns requires-confirmation)
 *        Tier 3 = admin allowlist gate
 *      Tier-3 admin gate runs BEFORE input validation so non-admins
 *      can't fingerprint restricted tools by feeding bad args and
 *      reading the schema error.
 *
 *   3. RECEIPT-FRIENDLY OUTPUTS — every dispatch returns a
 *      `ToolCallResult` discriminated union that embeds verbatim in
 *      the agent receipt. /api/replay can re-run the same call with
 *      the same args + same identity.
 */

import { z } from "zod";
import type { ActionTier } from "@/lib/action-tiers";

// ── Public types ──────────────────────────────────────────────────────────

/**
 * Context the registry passes to every tool. The shape mirrors what
 * `requireAuth()` already produces, plus a few fields the registry
 * itself injects (agentSlug for audit trails, approvalToken from the
 * caller for Tier-2 confirmation).
 */
export interface ToolContext {
  userId: string;
  tenantId: string;
  agentSlug: string;
  /** Tier-2 confirmation token. Caller mints + stores; registry compares. */
  approvalToken?: string;
}

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  /** Stable identifier the model emits in tool-call envelopes. */
  name: string;
  /** Short description fed to the model (one sentence, present tense). */
  description: string;
  /** Zod schema for the args object. */
  inputSchema: z.ZodType<TInput>;
  /** Approval tier — controls dispatch gating. */
  tier: ActionTier;
  /** Side-effecting work. Receives validated input + context. */
  execute: (input: TInput, ctx: ToolContext) => Promise<TOutput>;
}

/**
 * Discriminated union of every possible dispatch outcome.
 * Embed verbatim in the agent receipt — every field is JSON-serializable.
 */
export type ToolCallResult =
  | { outcome: "ok"; tool: string; output: unknown }
  | { outcome: "unknown-tool"; tool: string; message: string }
  | { outcome: "input-invalid"; tool: string; issues: string[] }
  | { outcome: "requires-confirmation"; tool: string; tier: 2 }
  | { outcome: "restricted"; tool: string; tier: 3; reason: string }
  | { outcome: "error"; tool: string; message: string };

/**
 * Envelope the model emits inside ```json blocks for the tool-use
 * loop. Parsed via `parseToolCallOutput()`.
 */
export interface ToolCallEnvelope {
  toolCalls: Array<{ name: string; args: unknown }>;
  finalAnswer?: string;
}

// ── Registry ──────────────────────────────────────────────────────────────

/** Hard cap on the number of tool calls a model can emit per step.
 *  Cheap DoS protection — a runaway model can't trigger 1,000
 *  side-effects in one turn. */
export const MAX_TOOL_CALLS_PER_STEP = 10;

export const TOOL_CALL_SCHEMA: z.ZodType<ToolCallEnvelope> = z.object({
  toolCalls: z
    .array(z.object({ name: z.string(), args: z.unknown() }))
    .max(MAX_TOOL_CALLS_PER_STEP),
  finalAnswer: z.string().optional(),
});

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();
  private readonly admins = new Set<string>();

  /**
   * Register a tool. Throws on duplicate names — registration time is
   * the cheapest place to catch the bug.
   */
  register<TInput, TOutput>(tool: ToolDefinition<TInput, TOutput>): this {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool '${tool.name}' is already registered`);
    }
    if (!/^[a-z][a-z0-9_]*$/.test(tool.name)) {
      throw new Error(
        `Tool name '${tool.name}' must match /^[a-z][a-z0-9_]*$/ — keeps model emissions stable`,
      );
    }
    this.tools.set(tool.name, tool as ToolDefinition);
    return this;
  }

  /** Grant a userId admin status for Tier-3 dispatch. */
  grantAdmin(userId: string): this {
    this.admins.add(userId);
    return this;
  }

  /** Return tool names in stable alphabetical order. */
  list(): string[] {
    return [...this.tools.keys()].sort();
  }

  /** Lookup without exposing the internal map. */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Compact tool-list block for the model's system prompt. Stable
   * ordering (alphabetical by name) makes this prompt-cache friendly:
   * the same registry → same block → same cache key.
   */
  describeForModel(): string {
    const names = this.list();
    if (names.length === 0) return "─── TOOL USE ───\n(no tools registered)";
    const lines = [
      "─── TOOL USE ───",
      "You may call any of the following tools. Emit a JSON envelope:",
      '  {"toolCalls": [{"name": "...", "args": {...}}, ...], "finalAnswer": "..." }',
      "Set toolCalls=[] + finalAnswer when you're done. Tools:",
    ];
    for (const name of names) {
      const t = this.tools.get(name)!;
      lines.push(`- ${name} (tier ${t.tier}) — ${t.description}`);
    }
    return lines.join("\n");
  }

  /**
   * Dispatch a single tool call. Never throws — every failure path
   * returns a `ToolCallResult` discriminant so the receipt stays
   * structured and the model can recover on the next turn.
   */
  async call(
    name: string,
    rawArgs: unknown,
    ctx: ToolContext,
  ): Promise<ToolCallResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        outcome: "unknown-tool",
        tool: name,
        message: `Tool '${name}' is not registered`,
      };
    }

    // ── Tier 3: admin allowlist BEFORE input validation. ──
    // Stops a non-admin from fingerprinting a restricted tool by
    // feeding bad args and reading the schema error message.
    if (tool.tier === 3 && !this.admins.has(ctx.userId)) {
      return {
        outcome: "restricted",
        tool: name,
        tier: 3,
        reason: "This tool requires an admin allowlist grant",
      };
    }

    // ── Input validation ──
    const parsed = tool.inputSchema.safeParse(rawArgs);
    if (!parsed.success) {
      return {
        outcome: "input-invalid",
        tool: name,
        issues: parsed.error.issues.map(
          (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
        ),
      };
    }

    // ── Tier 2: needs `approvalToken` ──
    if (tool.tier === 2 && !ctx.approvalToken) {
      return { outcome: "requires-confirmation", tool: name, tier: 2 };
    }

    try {
      const output = await tool.execute(parsed.data, ctx);
      return { outcome: "ok", tool: name, output };
    } catch (err) {
      return {
        outcome: "error",
        tool: name,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

// ── Tool-call envelope parsing ─────────────────────────────────────────────

const FENCE_RE = /^```(?:json)?\s*\n?|\n?```$/g;

/**
 * Parse a model's raw output into a tool-call envelope.
 *
 * - Strips leading/trailing code fences (```json ... ```).
 * - Returns null on malformed JSON or schema-invalid output (callers
 *   surface this as `no-tool-call-parse` to the user).
 * - Enforces `MAX_TOOL_CALLS_PER_STEP` via the schema — runaway models
 *   can't emit 1,000 tool calls in one turn.
 */
export function parseToolCallOutput(raw: string): ToolCallEnvelope | null {
  const trimmed = raw.trim().replace(FENCE_RE, "").trim();
  if (!trimmed.startsWith("{")) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  const result = TOOL_CALL_SCHEMA.safeParse(parsed);
  return result.success ? result.data : null;
}
