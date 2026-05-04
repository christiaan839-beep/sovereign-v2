/**
 * Cost Ledger — best-effort per-call cost accounting.
 *
 * Logs token / character usage for each AI invocation. Persistence is
 * optional: if the `usage` table isn't migrated yet, entries are dropped
 * silently. Callers should never await for ledger writes — fire and forget.
 */

import { db } from "@/db";
import { usage } from "@/db/schema";
import { createLogger } from "@/lib/logger";

const log = createLogger("cost-ledger");

export interface LedgerEntry {
  modelId: string;
  inputTokens?: number;
  outputTokens?: number;
  inputChars?: number;
  outputChars?: number;
  userId?: string;
  agent?: string;
}

export async function recordLedgerEntry(entry: LedgerEntry): Promise<void> {
  const inputTokens = entry.inputTokens ?? 0;
  const outputTokens = entry.outputTokens ?? 0;

  try {
    await db.insert(usage).values({
      userId: entry.userId ?? "system",
      agentId: entry.agent ?? entry.modelId,
      model: entry.modelId,
      tokensUsed: inputTokens + outputTokens,
      inputTokens: entry.inputTokens ?? null,
      outputTokens: entry.outputTokens ?? null,
    });
  } catch (err) {
    // Usage table missing or schema drift — never block on telemetry.
    log.info("recordLedgerEntry skipped", { error: String(err) });
  }
}
