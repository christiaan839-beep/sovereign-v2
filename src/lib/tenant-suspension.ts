/**
 * Tenant suspension — the kill-switch read path.
 *
 * Backed by `tenants.is_suspended` (added in
 * drizzle/0024_tenant_kill_switch.sql). Read on every authenticated
 * agent execution by `src/lib/agent-factory.ts`. The write path is
 * the admin endpoint at `src/app/api/_admin/suspend-tenant`.
 *
 * Failure modes are deliberate fail-OPEN. If we can't determine
 * suspension status (table missing, DB unavailable, column absent
 * because migration 0024 hasn't been applied), we let the request
 * through — better to serve a request than to lock the entire
 * platform out because of a database hiccup. Suspensions are a
 * deliberate operator action; they have to land in real Postgres
 * to take effect.
 *
 * In-memory cache: 30 seconds. Sized so a flip in the admin
 * propagates fast enough for an operator workflow ("I just
 * suspended X, run a smoke check") without re-reading the same
 * row hundreds of times for a chatty tenant.
 */

import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("tenant-suspension");

export interface SuspensionInfo {
  reason: string | null;
  suspendedAt: string | null;
}

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { value: SuspensionInfo | null; at: number }>();

function fromCache(id: string): SuspensionInfo | null | undefined {
  const hit = cache.get(id);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(id);
    return undefined;
  }
  return hit.value;
}

function toCache(id: string, value: SuspensionInfo | null): void {
  cache.set(id, { value, at: Date.now() });
}

/**
 * Returns null when the tenant is active, or a `SuspensionInfo`
 * payload when suspended. Callers (agent-factory) translate
 * non-null into a 423 Locked response.
 */
export async function isTenantSuspended(
  tenantId: string,
): Promise<SuspensionInfo | null> {
  const cached = fromCache(tenantId);
  if (cached !== undefined) return cached;

  try {
    const [row] = await db
      .select({
        isSuspended: tenants.isSuspended,
        suspensionReason: tenants.suspensionReason,
        suspendedAt: tenants.suspendedAt,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!row || !row.isSuspended) {
      toCache(tenantId, null);
      return null;
    }

    const value: SuspensionInfo = {
      reason: row.suspensionReason ?? null,
      suspendedAt: row.suspendedAt ? row.suspendedAt.toISOString() : null,
    };
    toCache(tenantId, value);
    return value;
  } catch (err) {
    const pgCode = (err as { code?: string })?.code;
    // 42P01 = tenants table missing (clean install pre-0000).
    // 42703 = column missing (0024 not yet applied).
    // Both fail open per the module-level rationale.
    if (pgCode === "42P01" || pgCode === "42703") {
      toCache(tenantId, null);
      return null;
    }
    log.warn("isTenantSuspended lookup failed; failing open", {
      tenantId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Drop the cache entry for one tenant — called by the admin
 *  suspend endpoint after a write so the new state is visible
 *  inside the 30s TTL window. */
export function invalidateSuspensionCache(tenantId: string): void {
  cache.delete(tenantId);
}

/** Test hook — clears every entry. */
export function _resetSuspensionCache(): void {
  cache.clear();
}
