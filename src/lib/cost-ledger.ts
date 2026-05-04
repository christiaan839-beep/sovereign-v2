/**
 * Cost Ledger — best-effort per-call cost accounting.
 *
 * Logs token / character usage for each AI invocation. Persistence is
 * optional: if the `usage` table isn't migrated yet, entries are dropped
 * silently. Callers should never await for ledger writes — fire and forget.
 */

import { db } from "@/db";
import { sql } from "drizzle-orm";
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
  const totalTokens = inputTokens + outputTokens;

  try {
    await db.execute(sql`
      INSERT INTO usage (user_email, agent, tokens, created_at)
      VALUES (
        ${entry.userId ?? "system"},
        ${entry.agent ?? entry.modelId},
        ${totalTokens},
        NOW()
      )
    `);
  } catch (err) {
    // Usage table missing or schema drift — never block on telemetry.
    log.info("recordLedgerEntry skipped", { error: String(err) });
  }
}
