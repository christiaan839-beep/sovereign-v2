/**
 * COST GOVERNANCE — R102.
 *
 * Per-agent / per-team / per-tenant budget caps with alert
 * thresholds. The 5th of the 6 enterprise non-negotiables for an
 * agentic AI control plane (per the JBoltAI / n8n / UiPath analysis):
 * "Cost Governance — Per-agent/per-team budget caps with alerts."
 *
 * Why this exists alongside `cost-runaway.ts`:
 *   - cost-runaway.ts (R27) operates at the TENANT level — one
 *     daily cap for the whole tenant. Excellent against bankruptcy
 *     scenarios; coarse for finance-team budgeting.
 *   - R102 adds per-AGENT and per-TEAM granularity, so a CFO can
 *     allocate "$200/day for the marketing team's content agents"
 *     without globally throttling the tenant.
 *
 * DESIGN CONTRACT:
 *
 *   1. Pure functions throughout. Caller assembles the spend ledger
 *     state (what's been spent, what's planned). Engine returns a
 *     deterministic decision + procurement-readable reason.
 *
 *   2. Composes with `provider-costs.ts` (already shipped) for free /
 *      paid / metered classification. A planned run that hits only
 *      free providers (Ollama, NIM, Groq, Cerebras) doesn't count
 *      against budget. This is the integration with FREE_ONLY_MODE.
 *
 *   3. Three caps, evaluated together. Tenant cap (existing R27),
 *      team cap (new), agent cap (new). If ANY would be breached,
 *      the run is denied. The most-restrictive wins.
 *
 *   4. Alert thresholds at 50% / 75% / 90%. Returns the highest
 *      threshold crossed by the planned run so the UI can show the
 *      right color (green / yellow / orange / red).
 *
 *   5. Procurement-readable reason. Decisions include the budget
 *      that fired, the projected end-state, and the alert level.
 *      A CFO can read the JSON without source code.
 */

import { PROVIDER_COSTS, type CostTier } from "@/lib/provider-costs";

// ── Types ──────────────────────────────────────────────────────────

export interface BudgetCap {
  /** Hard ceiling in cents. 0 = paused. -1 = unlimited. */
  capCents: number;
  /** ISO 8601 — start of the current cap window. */
  windowStart: string;
  /** ISO 8601 — when the window resets (typically next UTC midnight). */
  windowEnd: string;
}

export interface CostGovernanceContext {
  /** R34 tenant invoking the agent. */
  tenantId: string;
  /** Optional team identifier (free-form, e.g. "marketing", "finance"). */
  teamId?: string;
  /** Slug of the agent the run targets. */
  agentId: string;
  /** Provider that will serve the model call. */
  provider: string;
  /** Estimated cost in cents for the run. */
  plannedCostCents: number;

  /** Already spent against the tenant cap, current window. */
  tenantSpentCents: number;
  /** The tenant's cap. Required. */
  tenantCap: BudgetCap;

  /** Already spent against the team cap, current window. Optional. */
  teamSpentCents?: number;
  /** Team cap. Optional — if absent, no team-level enforcement. */
  teamCap?: BudgetCap;

  /** Already spent against this agent's cap. Optional. */
  agentSpentCents?: number;
  /** Per-agent cap. Optional. */
  agentCap?: BudgetCap;

  /** Now (testability + clock skew). */
  now?: Date;
}

export type CostAlertLevel = "ok" | "warn-50" | "warn-75" | "warn-90";

export type CostGovernanceVerdict =
  | { decision: "proceed"; alertLevel: CostAlertLevel; reason: string; freeRun: boolean; projectedSpendCents: number }
  | {
      decision: "deny";
      reason: string;
      breachedScope: "tenant" | "team" | "agent" | "window-elapsed";
      capCents: number;
      currentSpendCents: number;
      plannedCostCents: number;
    };

// ── Pure helpers ──────────────────────────────────────────────────

/**
 * Pure: check if the cap window is still active (now < windowEnd).
 * Caller is responsible for rolling over windows.
 */
export function isWindowActive(cap: BudgetCap, now: Date): boolean {
  return now < new Date(cap.windowEnd);
}

/**
 * Pure: alert level based on projected spend / cap.
 * Returns the HIGHEST threshold crossed.
 */
export function alertLevelFor(
  projectedCents: number,
  capCents: number,
): CostAlertLevel {
  if (capCents <= 0) return "warn-90"; // paused or zero cap → max alert
  const ratio = projectedCents / capCents;
  if (ratio >= 0.9) return "warn-90";
  if (ratio >= 0.75) return "warn-75";
  if (ratio >= 0.5) return "warn-50";
  return "ok";
}

/**
 * Pure: classify a provider as free / paid / metered using the
 * shipped PROVIDER_COSTS catalog.
 */
export function providerCostTier(provider: string): CostTier {
  return PROVIDER_COSTS[provider] ?? "paid";
}

// ── Pure: the main evaluator ──────────────────────────────────────

/**
 * Pure: evaluate a planned agent run against tenant + team + agent
 * budgets. Returns proceed/deny with procurement-readable reason.
 *
 * Most-restrictive wins. If any cap would be breached, run is denied
 * and the verdict identifies the breached scope.
 *
 * Free-tier provider runs (Ollama, NIM, Cerebras, Groq) bypass the
 * cost gate but still report the alert level for transparency.
 */
export function evaluateBudgets(
  ctx: CostGovernanceContext,
): CostGovernanceVerdict {
  const now = ctx.now ?? new Date();
  const tier = providerCostTier(ctx.provider);
  const isFree = tier === "free";

  // Window-elapsed check on tenant cap (caller should rotate, but
  // we surface as a deny so an expired ledger row is visible).
  if (!isWindowActive(ctx.tenantCap, now)) {
    return {
      decision: "deny",
      reason: `tenant cap window ended at ${ctx.tenantCap.windowEnd}; rotate ledger`,
      breachedScope: "window-elapsed",
      capCents: ctx.tenantCap.capCents,
      currentSpendCents: ctx.tenantSpentCents,
      plannedCostCents: ctx.plannedCostCents,
    };
  }

  // For free-tier runs we bypass cap checks but still report alert
  // level on the tenant cap so dashboards stay accurate.
  if (isFree) {
    const projected = ctx.tenantSpentCents; // free → no addition
    return {
      decision: "proceed",
      alertLevel: alertLevelFor(projected, ctx.tenantCap.capCents),
      reason: `provider ${ctx.provider} is free-tier; no cost charged`,
      freeRun: true,
      projectedSpendCents: projected,
    };
  }

  // Tenant cap.
  const tenantProjected = ctx.tenantSpentCents + ctx.plannedCostCents;
  if (
    ctx.tenantCap.capCents !== -1 &&
    tenantProjected > ctx.tenantCap.capCents
  ) {
    return {
      decision: "deny",
      reason: `would exceed tenant daily cap: ${ctx.tenantSpentCents}¢ + ${ctx.plannedCostCents}¢ > ${ctx.tenantCap.capCents}¢`,
      breachedScope: "tenant",
      capCents: ctx.tenantCap.capCents,
      currentSpendCents: ctx.tenantSpentCents,
      plannedCostCents: ctx.plannedCostCents,
    };
  }

  // Team cap.
  if (ctx.teamCap !== undefined && ctx.teamSpentCents !== undefined) {
    if (!isWindowActive(ctx.teamCap, now)) {
      return {
        decision: "deny",
        reason: `team cap window ended at ${ctx.teamCap.windowEnd}; rotate ledger`,
        breachedScope: "window-elapsed",
        capCents: ctx.teamCap.capCents,
        currentSpendCents: ctx.teamSpentCents,
        plannedCostCents: ctx.plannedCostCents,
      };
    }
    const teamProjected = ctx.teamSpentCents + ctx.plannedCostCents;
    if (
      ctx.teamCap.capCents !== -1 &&
      teamProjected > ctx.teamCap.capCents
    ) {
      return {
        decision: "deny",
        reason: `would exceed team cap (${ctx.teamId ?? "unknown"}): ${ctx.teamSpentCents}¢ + ${ctx.plannedCostCents}¢ > ${ctx.teamCap.capCents}¢`,
        breachedScope: "team",
        capCents: ctx.teamCap.capCents,
        currentSpendCents: ctx.teamSpentCents,
        plannedCostCents: ctx.plannedCostCents,
      };
    }
  }

  // Agent cap.
  if (ctx.agentCap !== undefined && ctx.agentSpentCents !== undefined) {
    if (!isWindowActive(ctx.agentCap, now)) {
      return {
        decision: "deny",
        reason: `agent cap window ended at ${ctx.agentCap.windowEnd}; rotate ledger`,
        breachedScope: "window-elapsed",
        capCents: ctx.agentCap.capCents,
        currentSpendCents: ctx.agentSpentCents,
        plannedCostCents: ctx.plannedCostCents,
      };
    }
    const agentProjected = ctx.agentSpentCents + ctx.plannedCostCents;
    if (
      ctx.agentCap.capCents !== -1 &&
      agentProjected > ctx.agentCap.capCents
    ) {
      return {
        decision: "deny",
        reason: `would exceed per-agent cap (${ctx.agentId}): ${ctx.agentSpentCents}¢ + ${ctx.plannedCostCents}¢ > ${ctx.agentCap.capCents}¢`,
        breachedScope: "agent",
        capCents: ctx.agentCap.capCents,
        currentSpendCents: ctx.agentSpentCents,
        plannedCostCents: ctx.plannedCostCents,
      };
    }
  }

  // Compute the highest alert level across all active caps.
  const alerts: CostAlertLevel[] = [
    alertLevelFor(tenantProjected, ctx.tenantCap.capCents),
  ];
  if (ctx.teamCap && ctx.teamSpentCents !== undefined) {
    alerts.push(
      alertLevelFor(
        ctx.teamSpentCents + ctx.plannedCostCents,
        ctx.teamCap.capCents,
      ),
    );
  }
  if (ctx.agentCap && ctx.agentSpentCents !== undefined) {
    alerts.push(
      alertLevelFor(
        ctx.agentSpentCents + ctx.plannedCostCents,
        ctx.agentCap.capCents,
      ),
    );
  }
  const highest = alerts.reduce<CostAlertLevel>((h, a) => {
    const order: CostAlertLevel[] = ["ok", "warn-50", "warn-75", "warn-90"];
    return order.indexOf(a) > order.indexOf(h) ? a : h;
  }, "ok");

  return {
    decision: "proceed",
    alertLevel: highest,
    reason: `proceed: tenant ${tenantProjected}¢ / ${ctx.tenantCap.capCents}¢${
      ctx.teamCap ? `; team ${(ctx.teamSpentCents ?? 0) + ctx.plannedCostCents}¢ / ${ctx.teamCap.capCents}¢` : ""
    }${ctx.agentCap ? `; agent ${(ctx.agentSpentCents ?? 0) + ctx.plannedCostCents}¢ / ${ctx.agentCap.capCents}¢` : ""}`,
    freeRun: false,
    projectedSpendCents: tenantProjected,
  };
}

// ── Convenience: budget preview (no run, no cost added) ───────────

export interface BudgetPreview {
  scope: "tenant" | "team" | "agent";
  capCents: number;
  spentCents: number;
  remainingCents: number;
  utilization: number; // 0-1
  alertLevel: CostAlertLevel;
  windowEnd: string;
}

/**
 * Pure: produce a snapshot of all active budgets for procurement
 * dashboard rendering. Used by the public /api/control-plane/budget
 * endpoint and the /trust/control-plane page.
 */
export function previewBudgets(
  ctx: Omit<CostGovernanceContext, "plannedCostCents" | "provider">,
): BudgetPreview[] {
  const out: BudgetPreview[] = [];
  out.push({
    scope: "tenant",
    capCents: ctx.tenantCap.capCents,
    spentCents: ctx.tenantSpentCents,
    remainingCents:
      ctx.tenantCap.capCents === -1
        ? -1
        : Math.max(0, ctx.tenantCap.capCents - ctx.tenantSpentCents),
    utilization:
      ctx.tenantCap.capCents <= 0
        ? 1
        : ctx.tenantSpentCents / ctx.tenantCap.capCents,
    alertLevel: alertLevelFor(ctx.tenantSpentCents, ctx.tenantCap.capCents),
    windowEnd: ctx.tenantCap.windowEnd,
  });
  if (ctx.teamCap && ctx.teamSpentCents !== undefined) {
    out.push({
      scope: "team",
      capCents: ctx.teamCap.capCents,
      spentCents: ctx.teamSpentCents,
      remainingCents:
        ctx.teamCap.capCents === -1
          ? -1
          : Math.max(0, ctx.teamCap.capCents - ctx.teamSpentCents),
      utilization:
        ctx.teamCap.capCents <= 0
          ? 1
          : ctx.teamSpentCents / ctx.teamCap.capCents,
      alertLevel: alertLevelFor(ctx.teamSpentCents, ctx.teamCap.capCents),
      windowEnd: ctx.teamCap.windowEnd,
    });
  }
  if (ctx.agentCap && ctx.agentSpentCents !== undefined) {
    out.push({
      scope: "agent",
      capCents: ctx.agentCap.capCents,
      spentCents: ctx.agentSpentCents,
      remainingCents:
        ctx.agentCap.capCents === -1
          ? -1
          : Math.max(0, ctx.agentCap.capCents - ctx.agentSpentCents),
      utilization:
        ctx.agentCap.capCents <= 0
          ? 1
          : ctx.agentSpentCents / ctx.agentCap.capCents,
      alertLevel: alertLevelFor(ctx.agentSpentCents, ctx.agentCap.capCents),
      windowEnd: ctx.agentCap.windowEnd,
    });
  }
  return out;
}
