/**
 * Cost ledger — writes per-call AI token spend into the `usage` table.
 *
 * Called fire-and-forget from `src/lib/nvidia.ts` and the unified
 * router's other provider clients. Never throws. Never blocks the
 * caller's hot path — `recordLedgerEntry()` always returns immediately
 * and the actual DB write completes in the background.
 *
 * Schema (see `src/db/schema.ts:202`):
 *   - `usage.model`             — upstream model id (e.g. "claude-sonnet-4-6")
 *   - `usage.provider`          — bucket from `model-attribution.ts`
 *   - `usage.input_tokens`      — provider-reported prompt tokens
 *   - `usage.output_tokens`     — provider-reported completion tokens
 *   - `usage.tokens_used`       — sum (legacy column)
 *   - `usage.cost_cents`        — estimated cost in USD cents
 *   - `usage.user_id`/`agent_id` — set by the caller; falls back to "unknown"
 *
 * If `inputTokens`/`outputTokens` are missing we fall back to a
 * char-based estimate (4 chars ≈ 1 token) so admin dashboards always
 * have something to graph.
 */

import { db } from "@/db";
import { usage } from "@/db/schema";
import { createLogger } from "@/lib/logger";
import { inferProvider, getLastProvider } from "@/lib/model-attribution";

const log = createLogger("cost-ledger");

export interface LedgerEntry {
  modelId: string;
  inputTokens?: number;
  outputTokens?: number;
  inputChars?: number;
  outputChars?: number;
  tenantId?: string;
  userId?: string;
  agentId?: string;
  requestId?: string;
}

const CHARS_PER_TOKEN = 4;

/**
 * USD-cents per 1K tokens, normalised input+output. Single number per
 * model keeps the table simple; we'll split into separate input/output
 * pricing if MRR ever justifies the precision.
 */
const COST_PER_1K_CENTS: Record<string, number> = {
  "nvidia/llama-3.1-nemotron-ultra-253b-v1": 0,
  "nvidia/llama-3.3-nemotron-super-49b-v1": 0,
  "deepseek-ai/deepseek-v3.2": 0,
  "google/gemma-4-31b-it": 0,
  "mistralai/mistral-large-2-instruct": 0,
  "claude-opus-4-7": 15,
  "claude-sonnet-4-6": 3,
  "claude-haiku-4-5-20251001": 0.5,
  "gemini-2.0-pro": 2.5,
  "gemini-2.0-flash": 0.1,
  "gpt-4o": 5,
};
const DEFAULT_PER_1K_CENTS = 1;

export function estimateCostCents(args: {
  modelId: string;
  inputTokens?: number;
  outputTokens?: number;
  inputChars?: number;
  outputChars?: number;
}): number {
  const tokens =
    (args.inputTokens ?? Math.ceil((args.inputChars ?? 0) / CHARS_PER_TOKEN)) +
    (args.outputTokens ?? Math.ceil((args.outputChars ?? 0) / CHARS_PER_TOKEN));
  const ratePer1K = COST_PER_1K_CENTS[args.modelId] ?? DEFAULT_PER_1K_CENTS;
  return Math.round((tokens / 1000) * ratePer1K);
}

/**
 * Record an AI call. Fire-and-forget — never await unless you want to
 * synchronise with the DB write (tests do).
 */
export async function recordLedgerEntry(entry: LedgerEntry): Promise<void> {
  try {
    const inputTokens =
      entry.inputTokens ?? Math.ceil((entry.inputChars ?? 0) / CHARS_PER_TOKEN);
    const outputTokens =
      entry.outputTokens ??
      Math.ceil((entry.outputChars ?? 0) / CHARS_PER_TOKEN);
    const totalTokens = inputTokens + outputTokens;
    const costCents = estimateCostCents(entry);
    const provider = getLastProvider() ?? inferProvider(entry.modelId);

    await db.insert(usage).values({
      userId: entry.userId ?? "unknown",
      agentId: entry.agentId ?? "unknown",
      model: entry.modelId,
      tokensUsed: totalTokens,
      inputTokens,
      outputTokens,
      costCents,
      provider,
      requestId: entry.requestId ?? null,
    });
  } catch (err) {
    // The whole point of fire-and-forget — never block the user.
    // 42P01 = relation does not exist; happens before migrations run.
    const pgCode = (err as { code?: string })?.code;
    if (pgCode === "42P01") return;
    log.warn("Cost-ledger write failed", {
      error: err instanceof Error ? err.message : String(err),
      modelId: entry.modelId,
    });
  }
}
