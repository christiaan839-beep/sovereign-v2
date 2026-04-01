/**
 * SOVEREIGN MATRIX — Tenant Scope Helpers
 *
 * Provides query-level tenant isolation for multi-tenant data access.
 * Use these helpers in API routes to ensure users only access their own data.
 *
 * Usage:
 *   import { requireTenantId, requireUserId } from "@/lib/tenant-scope";
 *
 *   // In an API route:
 *   const tenantId = requireTenantId(ctx);
 *   const rows = await db.select().from(table).where(eq(table.tenantId, tenantId));
 *
 *   // Or use the guard that returns a 403 response:
 *   const result = guardTenantAccess(ctx);
 *   if (result.denied) return result.response;
 */

import { NextResponse } from "next/server";
import type { AgentContext } from "@/lib/agent-factory";

/**
 * Extract tenantId from agent context or throw.
 * Use in agent handlers where tenant isolation is mandatory.
 */
export function requireTenantId(ctx: AgentContext): string {
  if (!ctx.tenantId) {
    throw new Error("Tenant context required but not available. User may not have a tenant record.");
  }
  return ctx.tenantId;
}

/**
 * Extract userId from agent context or throw.
 * Use in agent handlers where user isolation is mandatory.
 */
export function requireUserId(ctx: AgentContext): string {
  if (!ctx.userId) {
    throw new Error("Authentication required. No userId in agent context.");
  }
  return ctx.userId;
}

/**
 * Guard that returns a proper HTTP response if tenant context is missing.
 * Use in API routes (not agent handlers) for graceful denial.
 */
export function guardTenantAccess(ctx: { tenantId?: string; userId: string }):
  { denied: false; tenantId: string } | { denied: true; response: NextResponse } {
  if (!ctx.tenantId) {
    return {
      denied: true,
      response: NextResponse.json(
        { error: "Tenant context required. Complete onboarding first.", code: "NO_TENANT" },
        { status: 403 }
      ),
    };
  }
  return { denied: false, tenantId: ctx.tenantId };
}

/**
 * Verify that a resource belongs to the given tenant.
 * Prevents IDOR attacks where a user tries to access another tenant's resource.
 *
 * Usage:
 *   const row = await db.select().from(table).where(eq(table.id, resourceId));
 *   if (!belongsToTenant(row.tenantId, ctx.tenantId)) return errorResponse(...);
 */
export function belongsToTenant(resourceTenantId: string | null | undefined, userTenantId: string): boolean {
  if (!resourceTenantId || !userTenantId) return false;
  return resourceTenantId === userTenantId;
}
