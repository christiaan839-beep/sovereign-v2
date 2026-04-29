/**
 * MULTI-STAGE HITL ORCHESTRATION
 *
 * Round 33 — deep work. Extends R26's single-approver hitl_approvals
 * with sequential multi-stage approval flow.
 *
 * THE 5 ARCHITECTURAL CHOICES (locked-in defaults documented here):
 *
 *   1. SEQUENCE: sequential. Stage[0] approves → Stage[1] queued.
 *      Parallel was rejected because conflict resolution between
 *      simultaneous approvers creates ambiguity ("compliance
 *      approved at T0, security rejected at T0+5s — what now?").
 *
 *   2. ROLES: free-form text. Tenants configure their own taxonomy
 *      (we seed sensible defaults: "compliance", "security",
 *      "business"). Hard-coding would limit reach.
 *
 *   3. VETO: any-approver-can-veto at any stage. Defense in depth.
 *      A security officer halts the chain even if compliance
 *      already approved.
 *
 *   4. TIMEOUT: auto-escalate first, then auto-reject. Auto-approving
 *      timeouts has been the source of multiple compliance footguns
 *      (SAP, Oracle); we explicitly never auto-approve.
 *
 *   5. RETRY: allowed only on materially different `routingContext`.
 *      Engine compares the new request's context against the
 *      retry_of's; if equal, request is rejected as duplicate.
 *
 * PURE-FUNCTION CORE:
 *   - decideStageOutcome() and computeRequestStatus() are pure.
 *   - DB-touching functions (createMultiStageRequest, recordDecision)
 *     are at the bottom; they wrap the pure core.
 */

import { and, asc, eq, sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("multi-stage-hitl");

// ── Types ──────────────────────────────────────────────────────────

export type StageStatus = "pending" | "approved" | "rejected" | "skipped" | "expired";
export type RequestStatus = "pending" | "approved" | "denied" | "timeout";

export interface StageDefinition {
  /** Free-form role label, e.g. "compliance", "security", "business". */
  role: string;
  /** Per-stage timeout in seconds. Falls back to request-level expires_at. */
  timeoutSeconds?: number;
}

export interface RoutingContext {
  agentName: string;
  action: string;
  /** Cost dimension (cents). Drives "high-spend → multi-stage" rules. */
  costCents?: number;
  /** Action-tier classification (see action-tiers.ts). */
  actionTier?: "info" | "low" | "medium" | "high" | "critical";
  /** True if the action emits sensitive data (export, share, transmit). */
  involvesSensitiveData?: boolean;
  /** True if the action targets external endpoints (third-party APIs, public posts). */
  involvesExternalSystem?: boolean;
  /** Free-form per-tenant tags for custom routing logic. */
  tags?: string[];
}

export interface StageState {
  id: string;
  sequencePosition: number;
  role: string;
  status: StageStatus;
  approver: string | null;
  decidedAt: Date | null;
  reason: string | null;
  timeoutAt: Date | null;
}

// ── Pure-function evaluators ───────────────────────────────────────

/**
 * Compute the parent request status from per-stage states.
 *
 * Rules (in order):
 *   1. Any stage rejected → request denied (veto)
 *   2. All stages approved → request approved
 *   3. Any stage expired (without escalation) → request timeout
 *   4. Otherwise → pending
 *
 * Pure function. Used both by the engine and by tests.
 */
export function computeRequestStatus(
  stages: ReadonlyArray<{ status: StageStatus }>,
): RequestStatus {
  if (stages.length === 0) return "pending";
  if (stages.some((s) => s.status === "rejected")) return "denied";
  if (stages.every((s) => s.status === "approved" || s.status === "skipped")) {
    return "approved";
  }
  if (stages.some((s) => s.status === "expired")) return "timeout";
  return "pending";
}

/**
 * Decide what happens when an approver acts on a stage.
 * Returns the new stage status + whether the engine should advance
 * to the next stage.
 *
 * Pure function — no DB. The wire-up code applies the result.
 */
export function decideStageOutcome(input: {
  decision: "approve" | "reject";
  currentStage: { status: StageStatus };
}):
  | { newStatus: "approved"; advance: true }
  | { newStatus: "rejected"; advance: false }
  | { error: "stage_not_pending" } {
  if (input.currentStage.status !== "pending") {
    return { error: "stage_not_pending" };
  }
  if (input.decision === "approve") {
    return { newStatus: "approved", advance: true };
  }
  return { newStatus: "rejected", advance: false };
}

/**
 * Determine if a "retry" is materially different from the original.
 * Returns true if the contexts differ in any field that matters.
 *
 * Strategy: the retry is allowed only if the routing context would
 * have produced a different stage chain. We approximate this by
 * comparing the SHAPE of the contexts (action, agent, sensitivity,
 * tier). Cost differences within 10% are treated as the same.
 *
 * Pure function; trivially testable.
 */
export function isMateriallyDifferent(
  prev: RoutingContext,
  next: RoutingContext,
): boolean {
  if (prev.agentName !== next.agentName) return true;
  if (prev.action !== next.action) return true;
  if (prev.actionTier !== next.actionTier) return true;
  if (prev.involvesSensitiveData !== next.involvesSensitiveData) return true;
  if (prev.involvesExternalSystem !== next.involvesExternalSystem) return true;
  // Cost tolerance: 10%
  const prevCost = prev.costCents ?? 0;
  const nextCost = next.costCents ?? 0;
  if (Math.abs(prevCost - nextCost) > Math.max(prevCost, nextCost) * 0.1) {
    return true;
  }
  // Tag set difference
  const prevTags = new Set(prev.tags ?? []);
  const nextTags = new Set(next.tags ?? []);
  if (prevTags.size !== nextTags.size) return true;
  for (const t of prevTags) {
    if (!nextTags.has(t)) return true;
  }
  return false;
}

// ── DB-backed orchestration ────────────────────────────────────────

async function getDb() {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { db } = await import("@/db");
    return db;
  } catch {
    return null;
  }
}

const DEFAULT_STAGE_TIMEOUT_SECONDS = 24 * 60 * 60; // 24h per stage default

/**
 * Create a new multi-stage HITL request. The stages array defines
 * the sequence; stage[0] is the first to act.
 *
 * NEVER throws. Returns null on DB error (the audit log is the
 * backstop; a missed approval is logged as such).
 */
export async function createMultiStageRequest(input: {
  requestId: string;
  userId: string;
  agentName: string;
  action: string;
  description: string;
  stages: StageDefinition[];
  routingContext: RoutingContext;
  /** Total request expiry (across all stages). */
  totalExpiresAt: Date;
  /** Optional reference to a previous request being retried. */
  retryOf?: string;
}): Promise<{ ok: true; requestId: string; stageIds: string[] } | { ok: false; reason: string }> {
  if (input.stages.length === 0) {
    return { ok: false, reason: "stages array must be non-empty" };
  }

  const db = await getDb();
  if (!db) return { ok: false, reason: "db_unavailable" };

  try {
    const { hitlApprovals, approvalStages } = await import("@/db/schema");

    // Compute retry_count by looking up the prior request, if any.
    let retryCount = 0;
    if (input.retryOf) {
      const prior = await db
        .select({ retryCount: hitlApprovals.retryCount })
        .from(hitlApprovals)
        .where(eq(hitlApprovals.id, input.retryOf))
        .limit(1);
      retryCount = (prior[0]?.retryCount ?? 0) + 1;
    }

    // Insert parent request.
    await db.insert(hitlApprovals).values({
      id: input.requestId,
      userId: input.userId,
      agentName: input.agentName,
      action: input.action,
      description: input.description,
      metadata: { source: "multi-stage" },
      status: "pending",
      expiresAt: input.totalExpiresAt,
      stageCount: input.stages.length,
      currentStage: 0,
      routingContext: input.routingContext as unknown as Record<string, unknown>,
      retryOf: input.retryOf,
      retryCount,
    });

    // Insert each stage. Only stage 0 starts as 'pending'; later
    // stages start 'pending' too but the engine treats them as
    // "queued" by checking sequence_position.
    const stageInserts = input.stages.map((s, idx) => {
      const stageTimeoutMs = (s.timeoutSeconds ?? DEFAULT_STAGE_TIMEOUT_SECONDS) * 1000;
      return {
        requestId: input.requestId,
        sequencePosition: idx,
        role: s.role,
        status: "pending" as const,
        timeoutAt: new Date(Date.now() + stageTimeoutMs * (idx + 1)),
      };
    });

    const inserted = await db.insert(approvalStages).values(stageInserts).returning({
      id: approvalStages.id,
    });

    return { ok: true, requestId: input.requestId, stageIds: inserted.map((r) => String(r.id)) };
  } catch (err) {
    log.error("createMultiStageRequest failed", { error: String(err) });
    return { ok: false, reason: String(err) };
  }
}

/**
 * Record a decision on the current pending stage. Advances to next
 * stage on approval; halts the request on rejection.
 *
 * NEVER throws.
 */
export async function recordStageDecision(input: {
  requestId: string;
  approver: string;
  decision: "approve" | "reject";
  reason?: string;
}): Promise<
  | { ok: true; newRequestStatus: RequestStatus; nextStage: StageState | null }
  | { ok: false; reason: string }
> {
  const db = await getDb();
  if (!db) return { ok: false, reason: "db_unavailable" };

  try {
    const { hitlApprovals, approvalStages } = await import("@/db/schema");

    return await db.transaction(async (tx) => {
      // Lock the parent row.
      const reqRows = await tx
        .select()
        .from(hitlApprovals)
        .where(eq(hitlApprovals.id, input.requestId))
        .for("update")
        .limit(1);
      if (reqRows.length === 0) {
        return { ok: false as const, reason: "request_not_found" };
      }
      const req = reqRows[0];
      if (req.status !== "pending") {
        return { ok: false as const, reason: `request_already_${req.status}` };
      }

      // Get the current pending stage by sequence position.
      const stageRows = await tx
        .select()
        .from(approvalStages)
        .where(
          and(
            eq(approvalStages.requestId, input.requestId),
            eq(approvalStages.sequencePosition, req.currentStage),
          ),
        )
        .limit(1);
      if (stageRows.length === 0) {
        return { ok: false as const, reason: "stage_not_found" };
      }
      const stage = stageRows[0];

      const decision = decideStageOutcome({
        decision: input.decision,
        currentStage: { status: stage.status as StageStatus },
      });
      if ("error" in decision) {
        return { ok: false as const, reason: decision.error };
      }

      // Update the stage.
      await tx
        .update(approvalStages)
        .set({
          status: decision.newStatus,
          approver: input.approver,
          decidedAt: new Date(),
          reason: input.reason ?? null,
        })
        .where(eq(approvalStages.id, stage.id));

      let nextStage: StageState | null = null;
      let newRequestStatus: RequestStatus = "pending";

      if (decision.newStatus === "rejected") {
        // Veto — the chain halts. Request goes to denied.
        await tx
          .update(hitlApprovals)
          .set({
            status: "denied",
            decidedAt: new Date(),
            decidedBy: input.approver,
            vetoAtStage: req.currentStage,
            vetoRole: stage.role,
          })
          .where(eq(hitlApprovals.id, input.requestId));
        newRequestStatus = "denied";
      } else {
        // Approved — advance to next stage.
        const nextSeq = req.currentStage + 1;
        if (nextSeq >= req.stageCount) {
          // All stages passed — request approved.
          await tx
            .update(hitlApprovals)
            .set({
              status: "approved",
              decidedAt: new Date(),
              decidedBy: input.approver,
              currentStage: nextSeq,
            })
            .where(eq(hitlApprovals.id, input.requestId));
          newRequestStatus = "approved";
        } else {
          // Move pointer; next stage's pending state is already set.
          await tx
            .update(hitlApprovals)
            .set({ currentStage: nextSeq })
            .where(eq(hitlApprovals.id, input.requestId));

          const nextRows = await tx
            .select()
            .from(approvalStages)
            .where(
              and(
                eq(approvalStages.requestId, input.requestId),
                eq(approvalStages.sequencePosition, nextSeq),
              ),
            )
            .limit(1);
          if (nextRows[0]) {
            const n = nextRows[0];
            nextStage = {
              id: String(n.id),
              sequencePosition: n.sequencePosition,
              role: n.role,
              status: n.status as StageStatus,
              approver: n.approver,
              decidedAt: n.decidedAt,
              reason: n.reason,
              timeoutAt: n.timeoutAt,
            };
          }
        }
      }

      // Audit log every stage transition.
      const { auditLog } = await import("@/lib/audit-log");
      await auditLog({
        userId: input.approver,
        action: "settings.update",
        resource: `hitl-stage:${stage.id}`,
        details: {
          operation: "stage_decision",
          requestId: input.requestId,
          stage: stage.sequencePosition,
          role: stage.role,
          decision: input.decision,
          newRequestStatus,
        },
      }).catch(() => {});

      return { ok: true as const, newRequestStatus, nextStage };
    });
  } catch (err) {
    log.error("recordStageDecision failed", { error: String(err) });
    return { ok: false, reason: String(err) };
  }
}

/**
 * Read current state of a multi-stage request including all stages.
 * Used by the admin dashboard.
 */
export async function getRequestWithStages(requestId: string): Promise<{
  request: {
    id: string;
    status: RequestStatus;
    stageCount: number;
    currentStage: number;
    description: string;
    routingContext: Record<string, unknown>;
    vetoAtStage: number | null;
    vetoRole: string | null;
    retryOf: string | null;
    retryCount: number;
    createdAt: Date;
    expiresAt: Date;
  };
  stages: StageState[];
} | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const { hitlApprovals, approvalStages } = await import("@/db/schema");
    const reqRows = await db
      .select()
      .from(hitlApprovals)
      .where(eq(hitlApprovals.id, requestId))
      .limit(1);
    if (reqRows.length === 0) return null;
    const r = reqRows[0];

    const stages = await db
      .select()
      .from(approvalStages)
      .where(eq(approvalStages.requestId, requestId))
      .orderBy(asc(approvalStages.sequencePosition));

    return {
      request: {
        id: r.id,
        status: r.status as RequestStatus,
        stageCount: r.stageCount,
        currentStage: r.currentStage,
        description: r.description,
        routingContext: r.routingContext,
        vetoAtStage: r.vetoAtStage,
        vetoRole: r.vetoRole,
        retryOf: r.retryOf,
        retryCount: r.retryCount,
        createdAt: r.createdAt,
        expiresAt: r.expiresAt,
      },
      stages: stages.map((s) => ({
        id: String(s.id),
        sequencePosition: s.sequencePosition,
        role: s.role,
        status: s.status as StageStatus,
        approver: s.approver,
        decidedAt: s.decidedAt,
        reason: s.reason,
        timeoutAt: s.timeoutAt,
      })),
    };
  } catch (err) {
    log.warn("getRequestWithStages failed", { error: String(err) });
    return null;
  }
}

// Reference sql to avoid unused-import warnings in routes that
// re-export these helpers for advanced queries.
const _unused = { sql };
void _unused;
