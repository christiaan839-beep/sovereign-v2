import { db } from "@/db";
import { usage } from "@/db/schema";
import { estimateCostCents, estimateTokensFromChars } from "@/lib/model-costs";
import { getRequestContext } from "@/lib/request-context";
import { createLogger } from "@/lib/logger";

const log = createLogger("cost-ledger");

/**
 * COST LEDGER — records a single AI invocation's tokens + cost to the
 * usage table. Called from inside nimChat, ai(), claudeText, etc.
 *
 * Call signature is intentionally small — everything else (userId,
 * agentId, requestId) is pulled from the ambient request context
 * via AsyncLocalStorage. A call outside a request context (background
 * job, direct lib use) is a no-op, not an error.
 *
 * We batch fire-and-forget (catch+log) because a ledger write failure
 * must NEVER surface to the customer as a failed agent run. The cost
 * of missing a row in the ledger is a minor reporting discrepancy;
 * the cost of a 500 on a paid inference call is a refund.
 *
 * What to pass:
 *   - modelId: the canonical provider/model string (feeds into
 *     model-costs.ts rate lookup + model-attribution.ts)
 *   - inputTokens: from the provider response if available, else
 *     estimated from prompt char count
 *   - outputTokens: from the provider response if available, else
 *     estimated from completion char count
 */
export interface LedgerEntry {
  modelId: string;
  inputTokens?: number;
  outputTokens?: number;
  /** If the provider didn't return tokens, pass char counts and we'll estimate. */
  inputChars?: number;
  outputChars?: number;
}

export async function recordLedgerEntry(entry: LedgerEntry): Promise<void> {
  const ctx = getRequestContext();
  // Outside a request context (lib use, tests) — skip silently.
  if (!ctx?.userId) return;

  const inputTokens = entry.inputTokens
    ?? (entry.inputChars !== undefined ? estimateTokensFromChars(entry.inputChars) : 0);
  const outputTokens = entry.outputTokens
    ?? (entry.outputChars !== undefined ? estimateTokensFromChars(entry.outputChars) : 0);

  const { cents, rate } = estimateCostCents(entry.modelId, inputTokens, outputTokens);

  try {
    await db.insert(usage).values({
      userId: ctx.userId,
      agentId: ctx.agentName ?? "direct-api",
      model: entry.modelId,
      tokensUsed: inputTokens + outputTokens,
      inputTokens,
      outputTokens,
      costCents: cents,
      provider: rate.provider,
      requestId: ctx.requestId,
    });
  } catch (err) {
    // Table missing (pre-0012) or transient DB error — never block the
    // AI call that already succeeded. Log for ops observability.
    const code = (err as { code?: string })?.code;
    if (code === "42P01" || code === "42703") {
      // Pre-migration schema. Fall back to the legacy write shape so
      // usage data still lands while we wait for the migration to
      // apply.
      try {
        await db.insert(usage).values({
          userId: ctx.userId,
          agentId: ctx.agentName ?? "direct-api",
          model: entry.modelId,
          tokensUsed: inputTokens + outputTokens,
        });
      } catch {
        // Ignore; usage tracking isn't on the critical path.
      }
      return;
    }
    log.warn("cost ledger write failed", { error: String(err) });
  }
}
