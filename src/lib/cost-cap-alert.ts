/**
 * COST-CAP ALERT — operator + tenant notification when a tenant
 * auto-pauses on the daily spend cap.
 *
 * Round 27 — The Permanence Sprint.
 *
 * This module is the EFFECT side of the cost-runaway guard. The
 * guard itself (cost-runaway.ts) decides "should this tenant be
 * paused?" — this module decides "what happens when they are?"
 *
 * The two are deliberately separated so the alert strategy can
 * evolve (Slack → PagerDuty → SMS → custom playbook) without
 * touching the (well-tested, hot-path) cost ledger logic.
 *
 * INVOCATION CONTEXT:
 *   - Called from agent-factory.ts AFTER the run that crossed the
 *     cap completed successfully. The user already got their
 *     response; subsequent runs will 402.
 *   - Runs in the BACKGROUND via void/.catch — must NEVER throw
 *     (the user request already finished; we cannot affect it).
 *   - Idempotency is achieved by the ledger's `paused_at`
 *     transition: once set, subsequent runs return 402 BEFORE
 *     reaching the post-run path, so this fires once per (tenant, day).
 *
 * AUDIT TRAIL:
 *   The cost cap event itself is recorded in audit_logs (as part
 *   of the agent.execute audit) — this module's job is the
 *   PROACTIVE notification, not the durable record.
 */

import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";

const log = createLogger("cost-cap-alert");

export interface CostCapHitEvent {
  userId: string;
  planId: string | null;
  /** Cumulative spend in cents at the moment of cap-hit. */
  cumulativeCents: number;
  /** The cap the tenant crossed. */
  capCents: number;
  /** Which agent's run was the one that crossed the cap. */
  triggerAgentId: string;
}

/**
 * Fired ONCE per (tenant, day) when the cost cap is crossed.
 *
 * Trade-offs to consider:
 *
 * 1. EMAIL THE USER
 *    + Honest UX: they see the 402 and don't know why
 *    + Educates them about caps
 *    - Some users see "you spent too much" as a punishment
 *    - Email infrastructure failure = silent abuse continues
 *
 * 2. SLACK / SENTRY OPERATOR ALERT
 *    + Ops gets paged within seconds; can investigate live
 *    + Single source of truth for "who's currently paused"
 *    - Noisy if the cap is well-calibrated and gets hit often
 *
 * 3. AUDIT LOG ONLY
 *    + Permanent, queryable, hash-chained
 *    + Zero external-system dependencies
 *    - No proactive notification — operator must look
 *
 * 4. AUTO-EMAIL + AUDIT LOG (HYBRID)
 *    + User informed, ops has a queryable record
 *    + No PagerDuty escalation noise
 *    - Two systems to maintain
 *
 * 5. AUTO-EMAIL + SLACK + AUDIT LOG (FULL FANOUT)
 *    + Maximum visibility
 *    - Maximum complexity, multiple integration points to keep healthy
 *
 * The right answer depends on:
 *   - How often the cap legitimately gets hit (rare? notify everyone)
 *   - Whether ops has a Slack channel for incidents
 *   - Whether the user is technical (will read 402 body) or not
 *   - Whether the platform has a billing-success-team to triage
 *
 * Implementation guidance:
 *   - Use auditLog({ ... }) for the durable record (always do this).
 *   - For email: there's a Resend integration in src/lib/notify.ts
 *     (notifyAgentComplete) — extend with notifyCostCapHit() if going
 *     down route 1/4/5.
 *   - For Slack: src/lib/slack-incident.ts exists (R26) with
 *     postIncident() — use that if going down route 2/5.
 *   - For Sentry: createLogger().error() automatically captures.
 */
export async function onCostCapHit(event: CostCapHitEvent): Promise<void> {
  // STEP 1 — Always record the cap-hit in the audit log. This is
  // non-negotiable: the immutable trail must show every cost-cap
  // event for SOC 2 + customer-dispute resolution.
  await auditLog({
    userId: event.userId,
    action: "cost.cap_hit",
    resource: event.triggerAgentId,
    details: {
      planId: event.planId,
      cumulativeCents: event.cumulativeCents,
      capCents: event.capCents,
    },
  }).catch(() => {});

  // STEP 2 — TODO: pick a notification strategy. The current
  // implementation is the most conservative one (audit + structured
  // log only) so the platform is safe to ship. Production deployments
  // should likely add at least an operator Slack ping.
  log.error("Tenant auto-paused on cost cap", {
    userId: event.userId,
    planId: event.planId,
    cumulativeCents: event.cumulativeCents,
    capCents: event.capCents,
    triggerAgentId: event.triggerAgentId,
  });

  // ── USER CONTRIBUTION ──────────────────────────────────────────
  //
  // Add your alert dispatch here. Examples:
  //
  //   // Option A — email the user via Resend
  //   await import("@/lib/notify").then(m => m.notifyCostCapHit?.({
  //     userId: event.userId,
  //     dailyCap: event.capCents / 100,
  //     resetAt: nextUtcMidnight(),
  //   }));
  //
  //   // Option B — page operator via Slack
  //   await import("@/lib/slack-incident").then(m => m.postIncident?.({
  //     severity: "warning",
  //     title: `Tenant ${event.userId} hit daily cost cap`,
  //     details: `Spent $${event.cumulativeCents / 100} of $${event.capCents / 100} cap`,
  //   }));
  //
  //   // Option C — both, in parallel
  //   await Promise.allSettled([emailUser, pageOps]);
  //
  // What's right for YOUR deployment depends on:
  //   - How often the cap legitimately gets hit
  //   - Whether ops has a 24/7 Slack channel
  //   - Whether email infra (Resend) is healthy
  //
  // ───────────────────────────────────────────────────────────────
}

/**
 * Compute the next UTC midnight — the moment a paused tenant
 * automatically un-pauses. Useful when constructing user-facing
 * "will auto-resume at" copy.
 */
export function nextUtcMidnight(now: Date = new Date()): Date {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return next;
}
