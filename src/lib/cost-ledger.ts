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
import { NIM_MODELS } from "@/lib/nim-registry";
import { getCurrentTenantId } from "@/lib/request-tenant";

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
 * Paid-provider pricing (USD cents per 1K tokens, input+output
 * combined). NIM-served model prices are read from the canonical
 * `nim-registry.ts` — that's the single source of truth so adding
 * a new NIM model in one place automatically wires its cost here.
 *
 * If MRR ever justifies the precision, split into separate input
 * vs output rates per model. Today a flat rate is honest enough.
 */
const PAID_COST_PER_1K_CENTS: Record<string, number> = {
  "claude-opus-4-7": 15,
  "claude-sonnet-4-6": 3,
  "claude-haiku-4-5-20251001": 0.5,
  "gemini-2.0-pro": 2.5,
  "gemini-2.0-flash": 0.1,
  "gpt-4o": 5,
};
const DEFAULT_PER_1K_CENTS = 1;

/**
 * Look up cost-per-1K-tokens for any model id we route through.
 * Order: paid-provider table → NIM registry → fallback default.
 */
function costPer1KCents(modelId: string): number {
  if (modelId in PAID_COST_PER_1K_CENTS) {
    return PAID_COST_PER_1K_CENTS[modelId];
  }
  const nimModel = NIM_MODELS.find((m) => m.id === modelId);
  if (nimModel) return nimModel.costPer1KCents;
  return DEFAULT_PER_1K_CENTS;
}

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
  const ratePer1K = costPer1KCents(args.modelId);
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
      // Workspace-level attribution. Null is fine for legacy/public
      // surfaces — the admin dashboard buckets nulls under
      // "unattributed" instead of dropping them. Falls back to the
      // request-scoped tenant when the call site didn't pass one
      // explicitly (the typical case — agent-factory sets it once,
      // every downstream provider call inherits).
      tenantId: entry.tenantId ?? getCurrentTenantId() ?? null,
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
