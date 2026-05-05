/**
 * Cost ledger — fire-and-forget recording of per-call AI token spend.
 *
 * Stub implementation. The richer version (DB-backed per-tenant spend
 * tracking) was never landed; until it is, this no-op preserves the
 * "ledger is optional, never block the AI call" contract documented at
 * `src/lib/nvidia.ts:248`.
 */

export interface LedgerEntry {
  modelId: string;
  inputTokens?: number;
  outputTokens?: number;
  inputChars?: number;
  outputChars?: number;
  tenantId?: string;
  userId?: string;
}

export async function recordLedgerEntry(_entry: LedgerEntry): Promise<void> {
  // No-op. Real impl will write to a `cost_ledger` table.
}
