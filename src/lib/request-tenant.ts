/**
 * Request-scoped tenant context.
 *
 * Mirrors the AsyncLocalStorage pattern in `src/lib/model-attribution.ts`
 * so any code reachable from an authenticated agent route can ask
 * "which tenant is this request for?" without threading `tenantId`
 * through every call signature.
 *
 * Why this exists:
 *
 *   - The cost-ledger now writes `tenant_id` per row. To populate it
 *     from inside `nvidia.ts` (which has no tenant parameter), we
 *     read it here.
 *   - The deployment-profile gate in `ai.ts` needs to know which
 *     tenant is calling so it can refuse providers not allowed by
 *     that tenant's profile.
 *   - Agent-factory wraps every authenticated route in
 *     `withTenant(tenantId, ...)` once at the top — every downstream
 *     read is consistent for the lifetime of that request.
 *
 * Outside the `withTenant` wrapper, `getCurrentTenantId()` returns
 * null. That's intentional: legacy public surfaces (lead form
 * generation, marketing copy) have no tenant context, and a null
 * tenant id maps to deployment_profile = "cloud" (default), so
 * nothing breaks.
 */

import { AsyncLocalStorage } from "node:async_hooks";

interface TenantState {
  tenantId: string | null;
}

const storage = new AsyncLocalStorage<TenantState>();

/**
 * Wrap an async fn so all `getCurrentTenantId()` reads inside it
 * resolve to the supplied id. Nesting is safe: an inner
 * `withTenant("other")` shadows the outer for its scope only.
 */
export function withTenant<T>(
  tenantId: string | null,
  fn: () => Promise<T> | T,
): Promise<T> {
  return Promise.resolve(storage.run({ tenantId }, fn));
}

/** Read the tenant id for the current async context, or null. */
export function getCurrentTenantId(): string | null {
  return storage.getStore()?.tenantId ?? null;
}

/** Test hook. */
export function _resetTenantContextForTests(): void {
  // No-op — AsyncLocalStorage scopes itself per `storage.run` call,
  // so there's nothing to clear globally. Provided for symmetry with
  // model-attribution._resetForTests so test files can be uniform.
}
