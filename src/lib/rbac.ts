import { db } from "@/db";
import { orgMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * SOVEREIGN MATRIX -- Role-Based Access Control
 *
 * Org roles: owner > admin > member > viewer
 * Each role grants a specific set of permissions.
 */

export type OrgRole = "owner" | "admin" | "member" | "viewer";

export const PERMISSIONS: Record<OrgRole, readonly string[]> = {
  owner: ["read", "write", "delete", "invite", "billing", "settings"],
  admin: ["read", "write", "delete", "invite", "settings"],
  member: ["read", "write"],
  viewer: ["read"],
} as const;

export function hasPermission(role: OrgRole, permission: string): boolean {
  return (PERMISSIONS[role] ?? []).includes(permission);
}

/**
 * Check whether a user has a specific permission within an organization.
 * Returns the user's role if allowed, or an error message.
 */
export async function requireOrgAccess(
  orgId: string,
  userId: string,
  permission: string
): Promise<{ allowed: boolean; role?: OrgRole; error?: string }> {
  try {
    const rows = await db
      .select()
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)))
      .limit(1);

    const membership = rows[0];
    if (!membership) {
      return { allowed: false, error: "You are not a member of this organization." };
    }

    const role = membership.role as OrgRole;
    if (!hasPermission(role, permission)) {
      return {
        allowed: false,
        role,
        error: `Your role (${role}) does not have the "${permission}" permission.`,
      };
    }

    return { allowed: true, role };
  } catch (err) {
    console.error("[RBAC] Access check failed:", err);
    return { allowed: false, error: "Failed to verify organization access." };
  }
}
