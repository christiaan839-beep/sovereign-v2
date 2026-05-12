/**
 * Tool Registry — typed function-calling for super-agents (Cook 36).
 *
 * The Tier-1 primitive that turns agents from "describe what to do"
 * into "actually do it." Every agent's `runSuperAgent()` call can now
 * include a `tools[]` list; when the model emits a tool-call in its
 * structured output, the registry validates the args (via the tool's
 * Zod schema), checks the action tier (autonomous / confirm /
 * restricted), and dispatches.
 *
 * Three contracts that make this elite-grade:
 *
 *   1. TYPED INPUTS. Every tool declares its input schema as Zod;
 *      args are validated before the tool function ever sees them.
 *      No "model said something weird" mid-execution exceptions.
 *
 *   2. THREE-TIER APPROVAL. Reuses ActionTier from action-tiers.ts.
 *      Tier 1 tools (read-only fetches, RAG lookups) run inline.
 *      Tier 2 (sendEmail, postSlack, writeMemory) require an
 *      `approvalToken` from the caller — UI confirms; only THEN
 *      dispatched. Tier 3 (deleteResource, transferFunds) refuse
 *      without admin allowlist.
 *
 *   3. RECEIPT-FRIENDLY OUTPUT. Every dispatch returns a structured
 *      `ToolCallResult` that embeds in the agent receipt verbatim —
 *      so /api/replay re-runs the SAME tool call with the SAME args
 *      and the SAME identity.
 *
 * Pure-data registry: tools are registered as plain data structs,
 * never as closures with hidden state. That's why we can test the
 * registry without mounting any actual side-effecting tool.
 */

import { z, type ZodTypeAny } from "zod";
import { type ActionTier } from "./action-tiers";
import { createLogger } from "./logger";

const log = createLogger("tool-registry");

/** Identity context passed to every tool execute(). */
export interface ToolContext {
  /** Authenticated user id (empty string for public agent calls). */
  userId: string;
  /** Authenticated tenant id (empty string for public agent calls). */
  tenantId: string;
  /** Slug of the agent that issued the call. For audit + telemetry. */
  agentSlug: string;
  /**
   * Approval token supplied by the calling UI for Tier-2 tools. When
   * absent and the tool is Tier-2, the registry returns
   * `requiresConfirmation` instead of executing. Tier-1 tools
   * ignore this.
   */
  approvalToken?: string;
}

/**
 * A tool definition. Registered once, dispatched many.
 *
 * Generics: <I> is the validated input shape (inferred from
 * inputSchema). <O> is the tool's return type (JSON-serializable).
 */
export interface ToolDefinition<I = unknown, O = unknown> {
  /** Slug. Must be unique across the registry. Snake-or-kebab case. */
  name: string;
  /**
   * What the tool does, written for the LLM (not the human). The
   * model sees this verbatim as the function description; clarity
   * directly affects how well the model picks the right tool.
   */
  description: string;
  /**
   * Zod schema for the args. Used for both runtime validation AND
   * generating the JSON Schema the LLM sees in its tool-list prompt.
   */
  inputSchema: ZodTypeAny;
  /**
   * Action tier — controls whether the tool runs autonomously,
   * needs a confirmation token, or is admin-restricted.
   * Mirrors src/lib/action-tiers.ts.
   */
  tier: ActionTier;
  /**
   * The actual side-effect. Receives validated input + identity
   * context, returns a JSON-serializable result. Must not throw on
   * caller-controllable input — return a structured error instead.
   */
  execute: (input: I, ctx: ToolContext) => Promise<O>;
}

/** Outcome of a single tool call. */
export type ToolCallResult =
  | { outcome: "ok"; tool: string; output: unknown; ms: number }
  | {
      outcome: "input-invalid";
      tool: string;
      issues: Array<{ path: string; message: string }>;
    }
  | {
      outcome: "requires-confirmation";
      tool: string;
      tier: 2;
      preview: unknown;
    }
  | { outcome: "restricted"; tool: string; tier: 3; reason: string }
  | { outcome: "unknown-tool"; tool: string }
  | { outcome: "execution-failed"; tool: string; message: string };

/**
 * Build a JSON-schema-ish summary the LLM can see in its system
 * prompt. We DELIBERATELY avoid full JSON-schema generation — most
 * frontier models do fine with a compact text rendering and we
 * sidestep `zod-to-json-schema` dependency.
 *
 * Pure function — exported for testing.
 */
export function describeToolForModel(def: ToolDefinition): string {
  const shape =
    "shape" in def.inputSchema._def
      ? Object.entries(def.inputSchema._def.shape as Record<string, unknown>)
          .map(([k, v]) => {
            const desc = (v as { description?: string }).description;
            return `      ${k}${desc ? ` (${desc})` : ""}`;
          })
          .join("\n")
      : "      (free-form args)";
  return `- ${def.name} [tier ${def.tier}]\n    purpose: ${def.description}\n    args:\n${shape}`;
}

/**
 * The registry itself. Pure data — methods are static. No singleton
 * shared state; tests instantiate fresh registries per case.
 */
export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();
  /** Admin user ids permitted to invoke Tier-3 tools. Empty by default. */
  private adminUserIds = new Set<string>();

  register<I, O>(def: ToolDefinition<I, O>): this {
    if (this.tools.has(def.name)) {
      throw new Error(`Tool '${def.name}' already registered`);
    }
    if (!/^[a-z0-9][a-z0-9_-]{1,60}$/i.test(def.name)) {
      throw new Error(
        `Tool name '${def.name}' must match /^[a-z0-9][a-z0-9_-]{1,60}$/i`,
      );
    }
    this.tools.set(def.name, def as ToolDefinition);
    return this;
  }

  /** Make a user id eligible for Tier-3 invocations. */
  grantAdmin(userId: string): this {
    if (userId) this.adminUserIds.add(userId);
    return this;
  }

  /** Returns the registered tool defs as a stable-ordered list. */
  list(): ToolDefinition[] {
    return [...this.tools.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  /**
   * Build the tool-list block to inject into the agent's system
   * prompt. Sorted alphabetically for prompt-cache stability.
   */
  describeForModel(): string {
    const tools = this.list();
    if (tools.length === 0) return "No tools available.";
    return [
      "Available tools (call by name, args as JSON object):",
      ...tools.map(describeToolForModel),
    ].join("\n");
  }

  /**
   * Validate + dispatch a single tool call. Always returns a
   * structured `ToolCallResult` — never throws. Network failures
   * inside `execute` are wrapped as `execution-failed`.
   */
  async call(
    toolName: string,
    rawArgs: unknown,
    ctx: ToolContext,
  ): Promise<ToolCallResult> {
    const def = this.tools.get(toolName);
    if (!def) {
      log.warn("Unknown tool requested", { tool: toolName });
      return { outcome: "unknown-tool", tool: toolName };
    }

    // ── Tier-3 admin gate ─────────────────────────────────
    if (def.tier === 3 && !this.adminUserIds.has(ctx.userId)) {
      return {
        outcome: "restricted",
        tool: toolName,
        tier: 3,
        reason: `Tool '${toolName}' requires admin allowlist. Contact security@.`,
      };
    }

    // ── Input validation ───────────────────────────────────
    const parsed = def.inputSchema.safeParse(rawArgs);
    if (!parsed.success) {
      return {
        outcome: "input-invalid",
        tool: toolName,
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      };
    }

    // ── Tier-2 confirmation gate ─────────────────────────────
    if (def.tier === 2 && !ctx.approvalToken) {
      return {
        outcome: "requires-confirmation",
        tool: toolName,
        tier: 2,
        preview: parsed.data,
      };
    }

    // ── Dispatch ────────────────────────────────────────────
    const start = Date.now();
    try {
      const output = await def.execute(parsed.data, ctx);
      return {
        outcome: "ok",
        tool: toolName,
        output,
        ms: Date.now() - start,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.warn("Tool execution failed", { tool: toolName, message });
      return { outcome: "execution-failed", tool: toolName, message };
    }
  }
}

/**
 * The model's structured tool-call output. Agents using tools must
 * emit JSON matching this shape rather than free-text.
 *
 * Pure helper — exported so the super-agent can validate model
 * output before dispatching the call.
 */
export const TOOL_CALL_SCHEMA = z.object({
  toolCalls: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        args: z.record(z.string(), z.unknown()),
      }),
    )
    .max(10),
  finalAnswer: z.string().optional(),
});

export type ParsedToolCalls = z.infer<typeof TOOL_CALL_SCHEMA>;

/**
 * Parse a model's raw output into structured tool calls. Returns
 * null when the output is not a valid tool-calls envelope (so the
 * caller treats it as a plain answer instead).
 *
 * Pure function — exported for unit testing.
 */
export function parseToolCallOutput(raw: string): ParsedToolCalls | null {
  // Strip code fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/gm, "").replace(/```$/gm, "");
  // Find the first balanced {...}
  let depth = 0;
  let start = -1;
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (cleaned[i] === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        try {
          const obj = JSON.parse(cleaned.slice(start, i + 1));
          const parsed = TOOL_CALL_SCHEMA.safeParse(obj);
          return parsed.success ? parsed.data : null;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
