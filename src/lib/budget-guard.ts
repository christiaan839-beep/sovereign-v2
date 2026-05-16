/**
 * SOVEREIGN MATRIX — Budget enforcement guard (Wave 26).
 *
 * Thin wrapper around `checkBudget` that throws a typed
 * `BudgetExceededError` when a tenant has already exhausted its daily
 * AI-spend cap. Wired into the `ai()` cascade in src/lib/ai.ts as a
 * pre-flight check so a free-tier user can never drain the global
 * Anthropic key.
 *
 * Composes with:
 *   - src/lib/budget-controls.ts (checkBudget + recordSpend)
 *   - src/lib/event-bus.ts (publishes budget.threshold.crossed when
 *     a tenant crosses an 80% threshold)
 *   - src/lib/audit-log.ts (records every block as a structured event)
 *
 * Fail-open invariant: when the database is unreachable or the plan
 * lookup fails, the guard does NOT block. This is a deliberate trade-
 * off — a transient DB blip should never lock out a paying tenant.
 * The structured warning lets SRE notice repeated fail-opens.
 */

import { checkBudget } from "@/lib/budget-controls";
import { createLogger } from "@/lib/logger";

const log = createLogger("budget-guard");

export class BudgetExceededError extends Error {
  readonly userId: string;
  readonly dailyCents: number;
  readonly dailyLimitCents: number;
  readonly plan: string;

  constructor(opts: {
    userId: string;
    dailyCents: number;
    dailyLimitCents: number;
    plan: string;
    reason?: string;
  }) {
    super(
      opts.reason ??
        `Daily AI-spend cap reached (${opts.dailyCents}¢ / ${opts.dailyLimitCents}¢ on plan "${opts.plan}")`,
    );
    this.name = "BudgetExceededError";
    this.userId = opts.userId;
    this.dailyCents = opts.dailyCents;
    this.dailyLimitCents = opts.dailyLimitCents;
    this.plan = opts.plan;
  }
}

/**
 * Pre-flight budget check. Returns silently when the caller is within
 * budget; throws `BudgetExceededError` when over.
 *
 * Side effects:
 *   - At >=80% spend, emits `budget.threshold.crossed` on the event
 *     bus so the dashboard surfaces the warning. Emitted at most
 *     once per process per user per day via the in-memory `crossed`
 *     set (best-effort de-dup; the SSE consumer is idempotent on
 *     repeated identical alerts anyway).
 *   - On block, emits the same event with pctUsed=100 + records an
 *     audit-log row so the Wave-9 Bitcoin anchor sweeps the action.
 */
export async function enforceBudget(opts: {
  userId: string | null;
  planId?: string | null;
  tenantId?: string | null;
  /**
   * Provider price tier — used to short-circuit when the call is free.
   * We don't enforce against free-tier providers (NIM, Ollama, Cerebras
   * free tier) because the user can run unbounded calls there safely.
   */
  freeTier?: boolean;
}): Promise<void> {
  if (!opts.userId) return; // anonymous demo calls — not budget-tracked
  if (opts.freeTier === true) return;

  let result: Awaited<ReturnType<typeof checkBudget>>;
  try {
    result = await checkBudget(opts.userId, opts.planId ?? null);
  } catch (err) {
    // Fail-open. A DB blip should never lock out a paying tenant.
    log.warn("enforceBudget failed-open — checkBudget threw", {
      userId: opts.userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  // Threshold-crossed alert at 80%. Fire once per process per user.
  if (result.dailyPercent >= 80 && !_alertedToday.has(opts.userId)) {
    _alertedToday.add(opts.userId);
    try {
      const { publishBudgetThreshold } = await import("@/lib/event-bus");
      publishBudgetThreshold(opts.tenantId ?? "*", {
        usedCents: result.dailyCents,
        capCents: result.dailyLimitCents,
        pctUsed: result.dailyPercent,
      });
    } catch {
      /* non-blocking */
    }
  }

  if (!result.allowed) {
    // Audit the block — anchored to Bitcoin daily via Wave 9.
    try {
      const { auditLog } = await import("@/lib/audit-log");
      auditLog({
        userId: opts.userId,
        action: "credits.add",
        resource: "budget:blocked",
        details: {
          dailyCents: result.dailyCents,
          dailyLimitCents: result.dailyLimitCents,
          plan: result.plan,
          reason: result.reason,
        },
      }).catch(() => {});
    } catch {
      /* non-blocking */
    }
    throw new BudgetExceededError({
      userId: opts.userId,
      dailyCents: result.dailyCents,
      dailyLimitCents: result.dailyLimitCents,
      plan: result.plan,
      reason: result.reason,
    });
  }
}

// One-shot per-user "we already alerted" set for the current process.
// Cleared on a fresh deploy (acceptable — the alert is a courtesy
// indicator, not a security primitive).
const _alertedToday = new Set<string>();

/** Test-only: clear the alert set so test cases don't leak. */
export function _resetBudgetAlertsForTests(): void {
  _alertedToday.clear();
}
