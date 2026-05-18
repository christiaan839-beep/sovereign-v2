/**
 * Dual-approval middleware — aviation-CRM HITL escalation pattern.
 *
 * High-stakes actions (production schema migrations, wire transfers
 * above a threshold, mass account deletions) MUST require two
 * independent affirmative approvals before execution. This module is
 * the lock that gates them.
 *
 * Pattern (mirrors the Crew Resource Management decision lanes):
 *
 *   1. `request()` records a pending action with an SLA timer.
 *   2. Two distinct authorized humans (or one human + one validator
 *      model) call `approve(actionId, approverId)`.
 *   3. `consume(actionId, executorId)` checks both approvals are
 *      present + not expired, then atomically marks consumed and
 *      returns ok. The caller proceeds with the action.
 *   4. If the SLA timer expires with < 2 approvals, the action is
 *      auto-denied; the caller can `consume()` it but gets ok=false.
 *
 * All state lives in an in-memory map by default. A production
 * deployment swaps in a Postgres-backed store (interface below);
 * the contract stays the same.
 *
 * Audit trail: every request/approve/deny/consume event is logged
 * via `auditLog` so the regulator can reconstruct who decided what
 * and when.
 */

import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";

const log = createLogger("dual-approval");

export type ApprovalLane =
  | "low" // 15-second response window, default-deny on timeout
  | "pii" // 2-minute response window for PII modifications
  | "financial" // 15-minute response window for monetary actions
  | "schema"; // 30-minute response window for prod DB schema changes

const SLA_MS: Record<ApprovalLane, number> = {
  low: 15 * 1000,
  pii: 2 * 60 * 1000,
  financial: 15 * 60 * 1000,
  schema: 30 * 60 * 1000,
};

export interface DualApprovalRequest {
  /** Stable id for this action — caller provides (UUID recommended). */
  actionId: string;
  /** Free-form description of what's being approved (for the audit log). */
  description: string;
  /** Risk lane — determines SLA + retention policy. */
  lane: ApprovalLane;
  /** Who proposed the action (will be excluded from valid approver list). */
  proposerId: string;
  /** Optional structured payload (kept opaque + small). */
  payload?: Record<string, unknown>;
}

interface PendingAction {
  request: DualApprovalRequest;
  createdAt: number;
  expiresAt: number;
  approvals: Map<string, { approverId: string; approvedAt: number }>;
  consumed: boolean;
}

/** Storage interface — swap with a Postgres-backed impl for prod. */
export interface DualApprovalStore {
  get(actionId: string): PendingAction | undefined;
  set(actionId: string, action: PendingAction): void;
  delete(actionId: string): void;
  size(): number;
}

class InMemoryStore implements DualApprovalStore {
  private map = new Map<string, PendingAction>();
  get(id: string) {
    return this.map.get(id);
  }
  set(id: string, a: PendingAction) {
    this.map.set(id, a);
  }
  delete(id: string) {
    this.map.delete(id);
  }
  size() {
    return this.map.size;
  }
}

let store: DualApprovalStore = new InMemoryStore();

/**
 * Swap in a different store (Postgres, Redis) for production. Default
 * is the in-memory map — fine for single-process tests + initial
 * dev deployments.
 */
export function setDualApprovalStore(s: DualApprovalStore): void {
  store = s;
}

/** Test-only reset hook. */
export function _resetDualApprovalStore(): void {
  store = new InMemoryStore();
}

export interface ApprovalRecord {
  approverId: string;
  approvedAt: string;
}

export interface DualApprovalState {
  actionId: string;
  description: string;
  lane: ApprovalLane;
  proposerId: string;
  createdAt: string;
  expiresAt: string;
  approvals: ApprovalRecord[];
  consumed: boolean;
  /** Computed: now ≥ expiresAt && approvals.length < 2. */
  expired: boolean;
  /** Computed: approvals.length ≥ 2 && !expired && !consumed. */
  ready: boolean;
}

function snapshot(action: PendingAction, now: number): DualApprovalState {
  const expired = now >= action.expiresAt && action.approvals.size < 2;
  return {
    actionId: action.request.actionId,
    description: action.request.description,
    lane: action.request.lane,
    proposerId: action.request.proposerId,
    createdAt: new Date(action.createdAt).toISOString(),
    expiresAt: new Date(action.expiresAt).toISOString(),
    approvals: [...action.approvals.values()].map((a) => ({
      approverId: a.approverId,
      approvedAt: new Date(a.approvedAt).toISOString(),
    })),
    consumed: action.consumed,
    expired,
    ready: !expired && !action.consumed && action.approvals.size >= 2,
  };
}

/**
 * Request a dual-approval. Records the pending action + starts the
 * SLA timer. Caller distributes `actionId` to the two approvers
 * out-of-band (Slack, dashboard, email).
 *
 * Idempotent on `actionId` — re-requesting the same id is a no-op.
 */
export async function requestDualApproval(
  req: DualApprovalRequest,
  now: Date = new Date(),
): Promise<DualApprovalState> {
  const existing = store.get(req.actionId);
  if (existing) return snapshot(existing, now.getTime());

  const ttl = SLA_MS[req.lane];
  const action: PendingAction = {
    request: req,
    createdAt: now.getTime(),
    expiresAt: now.getTime() + ttl,
    approvals: new Map(),
    consumed: false,
  };
  store.set(req.actionId, action);

  await auditLog({
    userId: req.proposerId,
    action: "admin.grant",
    resource: `dual-approval:${req.actionId}`,
    details: {
      kind: "dual-approval.request",
      lane: req.lane,
      description: req.description,
      expiresAt: new Date(action.expiresAt).toISOString(),
    },
  });

  return snapshot(action, now.getTime());
}

export type ApprovalOutcome =
  | { ok: true; state: DualApprovalState }
  | { ok: false; reason: string; state?: DualApprovalState };

/**
 * Record an approval from one human (or validator). Rejects:
 *   - approverId === proposerId (no self-approval)
 *   - the same approverId twice
 *   - actions past their SLA window
 *   - already-consumed actions
 *
 * Two distinct approvers are required for `state.ready` to become true.
 */
export async function approve(
  actionId: string,
  approverId: string,
  now: Date = new Date(),
): Promise<ApprovalOutcome> {
  const action = store.get(actionId);
  if (!action) {
    return { ok: false, reason: "action not found" };
  }
  if (action.consumed) {
    return {
      ok: false,
      reason: "action already consumed",
      state: snapshot(action, now.getTime()),
    };
  }
  if (now.getTime() >= action.expiresAt) {
    return {
      ok: false,
      reason: "approval window expired",
      state: snapshot(action, now.getTime()),
    };
  }
  if (approverId === action.request.proposerId) {
    return {
      ok: false,
      reason: "proposer cannot self-approve",
      state: snapshot(action, now.getTime()),
    };
  }
  if (action.approvals.has(approverId)) {
    return {
      ok: false,
      reason: "approver already recorded",
      state: snapshot(action, now.getTime()),
    };
  }

  action.approvals.set(approverId, {
    approverId,
    approvedAt: now.getTime(),
  });

  await auditLog({
    userId: approverId,
    action: "admin.grant",
    resource: `dual-approval:${actionId}`,
    details: {
      kind: "dual-approval.approve",
      lane: action.request.lane,
      approvalCount: action.approvals.size,
    },
  });

  return { ok: true, state: snapshot(action, now.getTime()) };
}

/**
 * Atomically consume an approved action. Marks it consumed so it
 * cannot be reused (the caller must record `actionId` against the
 * underlying mutation for idempotency).
 *
 * Returns ok=false if:
 *   - action doesn't exist
 *   - fewer than 2 distinct approvers
 *   - SLA expired
 *   - already consumed
 */
export async function consume(
  actionId: string,
  executorId: string,
  now: Date = new Date(),
): Promise<ApprovalOutcome> {
  const action = store.get(actionId);
  if (!action) return { ok: false, reason: "action not found" };
  if (action.consumed) {
    return {
      ok: false,
      reason: "action already consumed",
      state: snapshot(action, now.getTime()),
    };
  }
  if (now.getTime() >= action.expiresAt && action.approvals.size < 2) {
    return {
      ok: false,
      reason: "approval window expired without 2 approvals",
      state: snapshot(action, now.getTime()),
    };
  }
  if (action.approvals.size < 2) {
    return {
      ok: false,
      reason: `insufficient approvals (have ${action.approvals.size}, need 2)`,
      state: snapshot(action, now.getTime()),
    };
  }

  action.consumed = true;
  await auditLog({
    userId: executorId,
    action: "admin.grant",
    resource: `dual-approval:${actionId}`,
    details: {
      kind: "dual-approval.consume",
      lane: action.request.lane,
      approvers: [...action.approvals.keys()],
    },
  });

  return { ok: true, state: snapshot(action, now.getTime()) };
}

/** Inspect the current state of an action (read-only). */
export function inspectApproval(
  actionId: string,
  now: Date = new Date(),
): DualApprovalState | null {
  const action = store.get(actionId);
  if (!action) return null;
  return snapshot(action, now.getTime());
}

/**
 * Sweep expired, never-consumed actions out of the store. A scheduled
 * job (cron, edge function) calls this hourly. Idempotent.
 */
export function gcExpired(now: Date = new Date()): number {
  let removed = 0;
  // We can't iterate maps safely while mutating in TS easily — collect first.
  // The InMemoryStore is small; a Postgres-backed impl would use a single
  // DELETE WHERE expires_at < now() statement.
  if (!(store instanceof InMemoryStore)) {
    log.warn(
      "gcExpired called on non-default store — implement GC in your DualApprovalStore",
    );
    return 0;
  }
  const inner = (store as unknown as { map: Map<string, PendingAction> }).map;
  const ids: string[] = [];
  for (const [id, action] of inner) {
    if (action.consumed) continue;
    if (now.getTime() >= action.expiresAt) ids.push(id);
  }
  for (const id of ids) {
    inner.delete(id);
    removed += 1;
  }
  return removed;
}
