/**
 * SOVEREIGN MATRIX — Audit subscription store (Cook 91).
 *
 * Closes the Cook 72 cron's "0 deliveries" gap. In-memory persistence
 * with the same swap-when-migration-0021-lands pattern as marketplace
 * and PAT stores.
 *
 * Subscriptions are owned by a tenant; one tenant can have many
 * subscriptions (monthly + quarterly, different deliverTo lists).
 */

import { randomUUID } from "crypto";
import type { AuditSubscription } from "@/lib/audit-bundle";

const STORE = new Map<string, AuditSubscription>();

export function listAllSubscriptions(): AuditSubscription[] {
  return [...STORE.values()];
}

export function listActiveSubscriptions(): AuditSubscription[] {
  return [...STORE.values()].filter((s) => s.active);
}

export function listSubscriptionsForTenant(
  tenantId: string,
): AuditSubscription[] {
  return [...STORE.values()].filter((s) => s.tenantId === tenantId);
}

export function getSubscription(id: string): AuditSubscription | undefined {
  return STORE.get(id);
}

export function createSubscription(
  init: Omit<AuditSubscription, "id">,
): AuditSubscription {
  if (!init.tenantId) throw new Error("tenantId is required");
  if (init.deliverTo.length === 0) {
    throw new Error("deliverTo must have at least one address");
  }
  if (init.frameworks.length === 0) {
    throw new Error("at least one framework is required");
  }
  const id = `sub_${randomUUID()}`;
  const record: AuditSubscription = { id, ...init };
  STORE.set(id, record);
  return record;
}

export function updateSubscription(
  id: string,
  patch: Partial<Omit<AuditSubscription, "id">>,
): AuditSubscription | undefined {
  const current = STORE.get(id);
  if (!current) return undefined;
  const next: AuditSubscription = { ...current, ...patch, id: current.id };
  STORE.set(id, next);
  return next;
}

export function pauseSubscription(id: string): AuditSubscription | undefined {
  return updateSubscription(id, { active: false });
}

export function resumeSubscription(id: string): AuditSubscription | undefined {
  return updateSubscription(id, { active: true });
}

export function deleteSubscription(id: string): boolean {
  return STORE.delete(id);
}

export function _resetForTests(): void {
  STORE.clear();
}
