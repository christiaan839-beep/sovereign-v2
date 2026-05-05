/**
 * Cost Ledger — thin wrapper around budget-controls.recordSpend.
 *
 * Kept for backwards compatibility with call sites that already use this
 * shape (eg. src/lib/nvidia.ts). New code should import recordSpend from
 * budget-controls directly to avoid the indirection.
 *
 * Single write path = single source of truth for AI spend. The `usage`
 * table is populated only by recordSpend; this file just adapts the
 * legacy interface.
 */

import { recordSpend } from "@/lib/budget-controls";

export interface LedgerEntry {
  modelId: string;
  inputTokens?: number;
  outputTokens?: number;
  /** Kept for legacy callers that pass character counts instead of tokens.
   *  Ignored by the cost calculation — only token counts price out
   *  correctly. Provide tokens whenever possible. */
  inputChars?: number;
  outputChars?: number;
  userId?: string;
  agent?: string;
}

export async function recordLedgerEntry(entry: LedgerEntry): Promise<void> {
  await recordSpend(
    entry.userId ?? "system",
    entry.modelId,
    entry.inputTokens ?? 0,
    entry.outputTokens ?? 0,
    entry.agent ?? entry.modelId,
  );
}
