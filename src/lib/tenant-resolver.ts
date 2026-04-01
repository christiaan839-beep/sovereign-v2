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
export async function resolveTenantId(userId: string): Promise<string | undefined> {
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
