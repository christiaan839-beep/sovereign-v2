/**
 * SOVEREIGN MATRIX — Tenant Resolver
 *
 * Resolves a Clerk userId to a tenant UUID for multi-tenant isolation.
 * Uses an in-memory LRU cache to avoid hitting the DB on every agent request.
 *
 * Usage:
 *   const tenantId = await resolveTenantId(userId);
 *   // Use tenantId in WHERE clauses: eq(table.tenantId, tenantId)
 */

import { db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";

/** Simple LRU cache: userId → tenantId. Evicts after MAX_SIZE entries. */
const TENANT_CACHE = new Map<string, { tenantId: string; cachedAt: number }>();
const MAX_CACHE_SIZE = 500;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Resolve a Clerk userId to the tenant UUID.
 * Returns undefined if the user has no tenant row (e.g., brand-new signup).
 */
export async function resolveTenantId(
  userId: string,
): Promise<string | undefined> {
  if (!userId) return undefined;

  // Check cache
  const cached = TENANT_CACHE.get(userId);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.tenantId;
  }

  try {
    const [row] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.clerkUserId, userId))
      .limit(1);

    if (!row) return undefined;

    // Cache the result
    if (TENANT_CACHE.size >= MAX_CACHE_SIZE) {
      // Evict oldest entry
      const oldestKey = TENANT_CACHE.keys().next().value;
      if (oldestKey) TENANT_CACHE.delete(oldestKey);
    }
    TENANT_CACHE.set(userId, { tenantId: row.id, cachedAt: Date.now() });

    return row.id;
  } catch {
    // DB error — don't block the request, just return undefined
    return undefined;
  }
}

/**
 * Invalidate the cached tenant for a user (e.g., after plan change).
 */
export function invalidateTenantCache(userId: string): void {
  TENANT_CACHE.delete(userId);
}

/**
 * Strict tenant resolution — throws TenantResolutionError if no tenant
 * is found for the given userId. Use this in any agent route that
 * writes tenant-scoped data; without it, a transient Neon error in
 * resolveTenantId() returns undefined and the caller silently runs
 * unscoped (cross-tenant data leakage risk).
 *
 * Wave 73 added this as the default boundary for new agent routes.
 * Legacy routes that still call resolveTenantId() directly should
 * migrate when next touched.
 */
export class TenantResolutionError extends Error {
  constructor(
    public readonly userId: string,
    message: string,
  ) {
    super(`${message} (userId=${userId})`);
    this.name = "TenantResolutionError";
  }
}

export async function requireTenantScope(userId: string): Promise<string> {
  if (!userId) {
    throw new TenantResolutionError("", "missing userId for tenant resolution");
  }
  const tenantId = await resolveTenantId(userId);
  if (!tenantId) {
    throw new TenantResolutionError(
      userId,
      "no tenant exists for this user — refusing to run unscoped",
    );
  }
  return tenantId;
}

/**
 * Build a Drizzle WHERE-fragment helper for tenant-scoped queries.
 *
 * Wraps the common pattern:
 *   const tenantId = await requireTenantScope(userId);
 *   const rows = await db.select().from(table).where(eq(table.tenantId, tenantId));
 *
 * Use as:
 *   const scope = await tenantScope(userId);
 *   const rows = await db.select().from(table).where(scope.eq(table.tenantId));
 *
 * The returned helper carries the resolved tenantId so multiple
 * downstream queries don't each re-hit the cache.
 */
export interface TenantScope {
  readonly tenantId: string;
  readonly userId: string;
}

export async function tenantScope(userId: string): Promise<TenantScope> {
  const tenantId = await requireTenantScope(userId);
  return Object.freeze({ tenantId, userId });
}
