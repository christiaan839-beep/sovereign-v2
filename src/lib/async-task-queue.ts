/**
 * SOVEREIGN MATRIX — Async task queue (Cook 127).
 *
 * Tenant-scoped FIFO queue with priority, visibility-timeout, and
 * dead-letter handling. Distinct from Cook 121 (outbound webhooks
 * with HTTP retry) — this is for INTERNAL async work (e.g. long-
 * running agent jobs, audit-bundle deliveries).
 *
 * Pure module — caller wires the persistence + worker pool.
 */

import { createHash, randomBytes } from "crypto";

// ── Public types ──────────────────────────────────────────────────────────

export type TaskStatus =
  | "pending"
  | "in-flight"
  | "succeeded"
  | "failed"
  | "dead";

export interface Task {
  id: string;
  tenantId: string;
  kind: string;
  payload: unknown;
  priority: number;
  status: TaskStatus;
  attempts: number;
  maxAttempts: number;
  enqueuedAt: number;
  visibleAt: number;
  /** Set when leased; null otherwise. */
  leaseExpiresAt?: number;
  lastError?: string;
}

export interface EnqueueRequest {
  tenantId: string;
  kind: string;
  payload: unknown;
  priority?: number;
  maxAttempts?: number;
  now?: number;
}

export interface LeaseRequest {
  tenantId?: string;
  kinds?: string[];
  visibilityTimeoutMs?: number;
  now?: number;
}

const DEFAULT_PRIORITY = 5;
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_VISIBILITY_MS = 30_000;

// ── Store ─────────────────────────────────────────────────────────────────

const STORE = new Map<string, Task>();

export function _resetForTests(): void {
  STORE.clear();
}

// ── Helpers ───────────────────────────────────────────────────────────────

function genId(): string {
  return `tsk_${createHash("sha256")
    .update(`${Date.now()}|${randomBytes(6).toString("hex")}`)
    .digest("hex")
    .slice(0, 20)}`;
}

// ── Public API ────────────────────────────────────────────────────────────

export function enqueue(req: EnqueueRequest): Task {
  if (!req.tenantId) throw new Error("enqueue: tenantId required");
  if (!req.kind) throw new Error("enqueue: kind required");
  const now = req.now ?? Date.now();
  const task: Task = {
    id: genId(),
    tenantId: req.tenantId,
    kind: req.kind,
    payload: req.payload,
    priority: req.priority ?? DEFAULT_PRIORITY,
    status: "pending",
    attempts: 0,
    maxAttempts: req.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    enqueuedAt: now,
    visibleAt: now,
  };
  STORE.set(task.id, task);
  return task;
}

/**
 * Lease the next eligible task. Selection order:
 *   1. tenant + kind filter
 *   2. visibleAt ≤ now
 *   3. status = pending OR (in-flight AND leaseExpiresAt ≤ now)
 *   4. highest priority first; FIFO tiebreaker
 */
export function lease(req: LeaseRequest = {}): Task | null {
  const now = req.now ?? Date.now();
  const eligible = [...STORE.values()].filter((t) => {
    if (req.tenantId && t.tenantId !== req.tenantId) return false;
    if (req.kinds && !req.kinds.includes(t.kind)) return false;
    if (t.visibleAt > now) return false;
    if (t.status === "pending") return true;
    if (
      t.status === "in-flight" &&
      t.leaseExpiresAt !== undefined &&
      t.leaseExpiresAt <= now
    ) {
      return true;
    }
    return false;
  });
  if (eligible.length === 0) return null;
  eligible.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return a.enqueuedAt - b.enqueuedAt;
  });
  const task = eligible[0];
  task.status = "in-flight";
  task.attempts++;
  task.leaseExpiresAt =
    now + (req.visibilityTimeoutMs ?? DEFAULT_VISIBILITY_MS);
  return task;
}

export function ack(id: string): boolean {
  const t = STORE.get(id);
  if (!t || t.status !== "in-flight") return false;
  t.status = "succeeded";
  t.leaseExpiresAt = undefined;
  return true;
}

export function nack(args: {
  id: string;
  error: string;
  /** ms to delay before next attempt. Default 0 (immediate). */
  delayMs?: number;
  now?: number;
}): boolean {
  const t = STORE.get(args.id);
  if (!t || t.status !== "in-flight") return false;
  const now = args.now ?? Date.now();
  t.lastError = args.error;
  if (t.attempts >= t.maxAttempts) {
    t.status = "dead";
    t.leaseExpiresAt = undefined;
    return true;
  }
  t.status = "pending";
  t.leaseExpiresAt = undefined;
  t.visibleAt = now + (args.delayMs ?? 0);
  return true;
}

export function get(id: string): Task | undefined {
  return STORE.get(id);
}

export function listByStatus(status: TaskStatus): Task[] {
  return [...STORE.values()].filter((t) => t.status === status);
}

export function listForTenant(tenantId: string): Task[] {
  return [...STORE.values()]
    .filter((t) => t.tenantId === tenantId)
    .sort((a, b) => b.enqueuedAt - a.enqueuedAt);
}

export const TASK_QUEUE_CONSTANTS = {
  DEFAULT_PRIORITY,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_VISIBILITY_MS,
};
