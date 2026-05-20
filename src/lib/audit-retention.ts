/**
 * SOVEREIGN MATRIX — Audit-log retention policy (wave 105).
 *
 * Federation infrastructure (waves 99–104), defense receipts (92),
 * capability receipts (94/98), and adversarial-eval (96) all write
 * to `audit_logs` on a recurring basis. Without retention, the table
 * grows unboundedly — ~50-100KB per cron tick adds up to multi-GB
 * within months on a busy deployment.
 *
 * This module ships a SAFETY-BY-DEFAULT retention policy:
 *
 *   - An explicit ALLOWLIST maps each prunable action → retention hours.
 *   - Actions NOT in the allowlist are NEVER deleted, regardless of
 *     age. This guards EVIDENCE rows (data.delete-receipt, DSAR
 *     exports, TRS attestations, login audit trail) against accidental
 *     loss if a future contributor adds a new action and forgets to
 *     decide its retention.
 *   - Reader-window conflicts are honoured: e.g., /api/security/posture
 *     queries defense.block over the last 24h, so the policy keeps
 *     defense.block for 30d (massive margin).
 *   - Per-run row cap (MAX_ROWS_PER_PRUNE) bounds the cron's wall-time
 *     so a backlog of stale rows can't time out the Vercel function.
 *     Multiple cron ticks drain the backlog incrementally.
 *
 * What is NOT pruned (intentional — these are EVIDENCE, not telemetry):
 *   - data.delete                — GDPR Art. 30 record of processing
 *   - data.delete-receipt        — wave-97 cryptographic deletion receipts
 *   - data.export                — DSAR export envelopes
 *   - data.audit-bundle          — auditor-replay artifacts
 *   - trs.attestation            — wave-95 threshold cosignatures
 *   - user.login / user.logout   — security audit trail
 *   - webauthn.*                 — auth events
 *   - admin.*                    — operator action trail
 *   - agent_token.*              — token issuance audit
 *
 * What IS pruned (operational telemetry with explicit windows):
 *   - honeypot.signal            — 24h  (matches wave-100 doc spec)
 *   - honeypot.bulletin          — 7d   (matches wave-99 MAX_TTL_HOURS)
 *   - adversarial.eval           — 30d  (multi-week public eval history)
 *   - defense.block              — 30d  (reader uses 24h; 30d is margin)
 *   - capability.invoke          — 30d  (high-volume operational data)
 *   - webhook.received           — 30d  (operational telemetry)
 *   - agent.execute              — 30d  (operational telemetry)
 *   - credits.add                — 30d  (purchase/grant rows; not refunds)
 *   - marketplace.run            — 30d  (operational telemetry)
 *
 * Pure helpers are exported for testing. The cron route imports
 * `runRetentionCycle` for the end-to-end execution.
 */

import { db } from "@/db";
import { sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("audit-retention");

/** Hard cap on rows pruned per action per cron tick. */
export const MAX_ROWS_PER_PRUNE = 10_000;

/**
 * Explicit allowlist mapping each prunable action → retention hours.
 * Adding an action here is a deliberate decision; missing actions are
 * NEVER pruned (safety-by-default). Map values are in HOURS.
 */
export const RETENTION_POLICIES: Readonly<Record<string, number>> =
  Object.freeze({
    // Federation operational telemetry — TTL matches the wave-99/100
    // documented bulletin/signal windows so we don't outlive the
    // bulletin's own expiry.
    "honeypot.signal": 24,
    "honeypot.bulletin": 168, // 7 days = MAX_TTL_HOURS in federation-bulletin.ts

    // Public adversarial-eval snapshots — operators want multi-week
    // history visible at /api/security/eval, but full year would
    // accumulate hundreds of MB.
    "adversarial.eval": 720, // 30 days

    // Defense receipts — /api/security/posture aggregates last 24h.
    // 30d gives massive reader-window margin.
    "defense.block": 720, // 30 days

    // Capability receipts — high-volume; auditor queries are short-window.
    "capability.invoke": 720, // 30 days

    // Operational telemetry — keep recent enough for incident debugging.
    "webhook.received": 720, // 30 days
    "agent.execute": 720, // 30 days
    "credits.add": 720, // 30 days (refund/grant rows separately preserved)
    "marketplace.run": 720, // 30 days
  });

export interface PruneActionResult {
  action: string;
  retentionHours: number;
  deleted: number;
  capped: boolean;
}

export interface RetentionCycleResult {
  startedAt: string;
  durationMs: number;
  totalDeleted: number;
  perAction: PruneActionResult[];
}

/**
 * Compute the cutoff Date — rows older than this are eligible for
 * deletion. Pure helper exported so tests don't need Date mocking.
 */
export function computeCutoff(
  retentionHours: number,
  now: Date = new Date(),
): Date {
  return new Date(now.getTime() - retentionHours * 3600 * 1000);
}

/**
 * Prune one action's audit_logs rows older than `retentionHours`.
 *
 * Uses parameterised SQL via Drizzle's sql template tag — action +
 * cutoff are bound, never interpolated. The LIMIT enforcement is
 * critical: without it, a backlog of stale rows could time out the
 * Vercel function. Postgres DELETE...USING with a subquery on the
 * primary key is the standard cap pattern (mirrors `LIMIT` on DELETE
 * which Postgres doesn't directly support).
 *
 * Returns `{deleted, capped}` — capped=true means we hit MAX_ROWS_PER_PRUNE
 * and the operator should expect another tick to drain remaining rows.
 */
export async function pruneAction(
  action: string,
  retentionHours: number,
): Promise<PruneActionResult> {
  const cutoff = computeCutoff(retentionHours);
  let deleted = 0;
  try {
    // Postgres DELETE doesn't support LIMIT directly. Use a CTE +
    // primary-key match to bound impact. The subquery picks at most
    // MAX_ROWS_PER_PRUNE row ids; the outer DELETE removes them.
    const result = await db.execute(sql`
      WITH victims AS (
        SELECT id FROM audit_logs
        WHERE action = ${action}
          AND created_at < ${cutoff}
        ORDER BY created_at ASC
        LIMIT ${MAX_ROWS_PER_PRUNE}
      )
      DELETE FROM audit_logs
      WHERE id IN (SELECT id FROM victims)
      RETURNING id
    `);
    // Drizzle's execute() returns different shapes depending on the
    // driver (array, {rowCount}, or {rows: [...]}). Try each known
    // shape. Wave-105 review M2: when the shape is none of the three,
    // log a warn rather than silently reporting deleted=0 — for a
    // destructive cron, observability is part of the safety contract.
    let shapeRecognised = true;
    if (Array.isArray(result)) {
      deleted = result.length;
    } else if (
      typeof result === "object" &&
      result !== null &&
      "rowCount" in result
    ) {
      deleted = Number((result as { rowCount?: number }).rowCount ?? 0);
    } else if (
      typeof result === "object" &&
      result !== null &&
      "rows" in result &&
      Array.isArray((result as { rows: unknown[] }).rows)
    ) {
      deleted = (result as { rows: unknown[] }).rows.length;
    } else {
      shapeRecognised = false;
      log.warn(
        "pruneAction: unrecognised drizzle result shape — deleted count " +
          "may under-report; cron observability degraded",
        {
          action,
          resultKeys:
            typeof result === "object" && result !== null
              ? Object.keys(result)
              : "non-object",
        },
      );
    }
    // Suppress unused-var warning when shapeRecognised is true.
    void shapeRecognised;
  } catch (err) {
    log.error("pruneAction failed", {
      action,
      retentionHours,
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return {
    action,
    retentionHours,
    deleted,
    capped: deleted >= MAX_ROWS_PER_PRUNE,
  };
}

/**
 * Run the full retention cycle — iterate every allowlisted action +
 * prune. Never throws — per-action failures are isolated. Returns
 * structured metrics so the cron can surface them for observability.
 */
export async function runRetentionCycle(): Promise<RetentionCycleResult> {
  const startedAt = new Date().toISOString();
  const start = Date.now();
  const perAction: PruneActionResult[] = [];
  for (const [action, hours] of Object.entries(RETENTION_POLICIES)) {
    const r = await pruneAction(action, hours);
    perAction.push(r);
  }
  return {
    startedAt,
    durationMs: Date.now() - start,
    totalDeleted: perAction.reduce((acc, r) => acc + r.deleted, 0),
    perAction,
  };
}

/**
 * Wave-105 review M1: safety-by-default invariant inverted from a
 * BLOCKLIST (EVIDENCE_ACTIONS, fail-open) to an ALLOWLIST
 * (OPERATIONAL_ACTIONS, fail-closed).
 *
 * Previously the guard listed evidence actions and threw if any
 * appeared in the policy map — but that only caught the 16 actions
 * named in the list. A future contributor adding e.g.
 * `subscription.change: 720` to "help with table size" would NOT
 * trip the guard because subscription.change wasn't in the blocklist.
 *
 * The allowlist below names ALL actions that ARE allowed to be
 * pruned. Any policy key NOT in this set throws at module load — the
 * build fails BEFORE the change reaches production, regardless of
 * whether the new action looks evidence-like or telemetry-like.
 *
 * To add a new prunable action: (1) add it to OPERATIONAL_ACTIONS,
 * (2) add the retention-hours entry to RETENTION_POLICIES. The pair
 * is the contract.
 */
export const OPERATIONAL_ACTIONS = new Set<string>([
  "honeypot.signal",
  "honeypot.bulletin",
  "adversarial.eval",
  "defense.block",
  "capability.invoke",
  "webhook.received",
  "agent.execute",
  "credits.add",
  "marketplace.run",
]);

for (const action of Object.keys(RETENTION_POLICIES)) {
  if (!OPERATIONAL_ACTIONS.has(action)) {
    throw new Error(
      `RETENTION_POLICIES key "${action}" is not in OPERATIONAL_ACTIONS. ` +
        `Every pruned action MUST be explicitly listed in the allowlist — ` +
        `safety-by-default. Either add "${action}" to OPERATIONAL_ACTIONS ` +
        `(deliberate decision that this is operational telemetry, not ` +
        `evidence) or remove it from RETENTION_POLICIES.`,
    );
  }
}
