/**
 * Tenant policy resolver — looks up the agent allow/deny policy for
 * a given tenantId. Cached for 5 minutes to avoid hammering the DB
 * on every agent invocation.
 *
 * Storage: assumes a `tenants.agent_policy` JSONB column. If the
 * column doesn't exist (pre-migration tenants), returns null and
 * the factory defaults to allow-all.
 *
 * NEVER throws. Returns null on any DB error.
 */

import type { TenantAgentPolicy } from "@/lib/tenant-agent-policy";
import { createLogger } from "@/lib/logger";
import { safeJsonParseObject } from "@/lib/safe-json";

const log = createLogger("tenant-policy-resolver");

const TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  policy: TenantAgentPolicy | null;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

export async function resolveTenantPolicy(
  tenantId: string,
): Promise<TenantAgentPolicy | null> {
  if (!tenantId) return null;
  const cached = cache.get(tenantId);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return cached.policy;
  }

  let policy: TenantAgentPolicy | null = null;
  try {
    if (!process.env.DATABASE_URL) {
      cache.set(tenantId, { policy: null, fetchedAt: Date.now() });
      return null;
    }
    const { db } = await import("@/db");
    const { sql } = await import("drizzle-orm");
    // Look up via raw SQL so we don't require the column to exist on
    // the typed schema (pre-migration deploys).
    const rows = (await db.execute(sql`
      SELECT agent_policy FROM tenants WHERE id = ${tenantId} LIMIT 1
    `)) as unknown as Array<{ agent_policy?: string | object }>;

    const raw = rows[0]?.agent_policy;
    if (raw == null) {
      policy = null;
    } else if (typeof raw === "string") {
      // safeJsonParseObject's generic must extend Record<string, unknown>.
      // Cast through that intermediate shape, then narrow.
      const parsed = safeJsonParseObject<Record<string, unknown>>(
        raw,
        "tenant.agent_policy",
      );
      policy = (parsed as { mode?: string }).mode
        ? (parsed as unknown as TenantAgentPolicy)
        : null;
    } else if (typeof raw === "object") {
      // PG JSONB returns parsed object directly.
      policy = raw as TenantAgentPolicy;
    }
  } catch (err) {
    log.debug("tenant policy lookup failed (allowing all)", {
      tenantId,
      error: (err as Error).message,
    });
    policy = null;
  }

  cache.set(tenantId, { policy, fetchedAt: Date.now() });
  return policy;
}

/** Test helper. */
export function __resetTenantPolicyCacheForTesting(): void {
  cache.clear();
}
