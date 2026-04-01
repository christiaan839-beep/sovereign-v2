import { db } from "@/db";
import { orgMembers } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
const log = createLogger("rbac");

/**
 * SOVEREIGN MATRIX -- Role-Based Access Control
 *
 * Org roles: owner > admin > editor > viewer
 * Each role grants a specific set of permissions.
 */

export type Role = "owner" | "admin" | "editor" | "viewer";

/** Legacy alias for backwards compatibility */
export type OrgRole = Role;

export const PERMISSIONS: Record<Role, readonly string[]> = {
  owner: ["*"], // everything
  admin: [
    "agents.execute",
    "agents.configure",
    "agents.view",
    "workflows.create",
    "workflows.run",
    "workflows.view",
    "settings.view",
    "settings.edit",
    "team.manage",
    "billing.view",
    "read",
    "write",
    "delete",
    "invite",
    "billing",
    "settings",
  ],
  editor: [
    "agents.execute",
    "agents.view",
    "workflows.create",
    "workflows.run",
    "workflows.view",
    "settings.view",
    "read",
    "write",
  ],
  viewer: [
    "agents.view",
    "workflows.view",
    "settings.view",
    "read",
  ],
} as const;

/** Role display metadata for UI */
export const ROLE_META: Record<Role, {
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  owner: {
    label: "Owner",
    description: "Full platform control including billing, team management, and all agent operations",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
  },
  admin: {
    label: "Admin",
    description: "Execute and configure agents, manage workflows, edit settings, and manage team members",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/20",
  },
  editor: {
    label: "Editor",
    description: "Execute agents, create and run workflows, and view settings",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
  },
  viewer: {
    label: "Viewer",
    description: "Read-only access to dashboards, reports, and workflow results",
    color: "text-neutral-400",
    bgColor: "bg-neutral-500/10",
    borderColor: "border-neutral-500/20",
  },
};

/** Ordered list of assignable roles (owner excluded — set at org creation only) */
export const ASSIGNABLE_ROLES: Role[] = ["admin", "editor", "viewer"];

/** All roles ordered by power level */
export const ALL_ROLES: Role[] = ["owner", "admin", "editor", "viewer"];

/**
 * Check if a role has a specific permission.
 * Owners have wildcard access ("*").
 */
export function hasPermission(role: Role, permission: string): boolean {
  const perms = PERMISSIONS[role];
  if (!perms) return false;
  return perms.includes("*") || perms.includes(permission);
}

/** Can this role execute agents? */
export function canExecuteAgent(role: Role): boolean {
  return hasPermission(role, "agents.execute");
}

/** Can this role manage team members? */
export function canManageTeam(role: Role): boolean {
  return hasPermission(role, "team.manage");
}

/** Can this role edit platform settings? */
export function canEditSettings(role: Role): boolean {
  return hasPermission(role, "settings.edit");
}

/** Can this role create workflows? */
export function canCreateWorkflow(role: Role): boolean {
  return hasPermission(role, "workflows.create");
}

/** Can this role view billing information? */
export function canViewBilling(role: Role): boolean {
  return hasPermission(role, "billing.view");
}

/** Can this role configure agents (not just execute)? */
export function canConfigureAgent(role: Role): boolean {
  return hasPermission(role, "agents.configure");
}

/**
 * Check whether a user has a specific permission within an organization.
 * Returns the user's role if allowed, or an error message.
 */
export async function requireOrgAccess(
  orgId: string,
  userId: string,
  permission: string
): Promise<{ allowed: boolean; role?: Role; error?: string }> {
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

    const role = membership.role as Role;
    if (!hasPermission(role, permission)) {
      return {
        allowed: false,
        role,
        error: `Your role (${role}) does not have the "${permission}" permission.`,
      };
    }

    return { allowed: true, role };
  } catch (err) {
    log.error("Access check failed", err as Record<string, unknown>);
    return { allowed: false, error: "Failed to verify organization access." };
  }
}

/**
 * Fetch the current user's role in an organization.
 * Returns null if not a member.
 */
export async function getUserRole(
  orgId: string,
  userId: string
): Promise<Role | null> {
  try {
    const rows = await db
      .select({ role: orgMembers.role })
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)))
      .limit(1);

    if (!rows[0]) return null;
    return rows[0].role as Role;
  } catch (err) {
    log.error("Failed to fetch user role", err as Record<string, unknown>);
    return null;
  }
}
