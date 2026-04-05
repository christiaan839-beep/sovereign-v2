/**
 * Tests for src/lib/rbac.ts — pure role/permission helpers
 *
 * The DB-backed helpers (requireOrgAccess, getUserRole) are covered by
 * integration tests. Here we lock in the permission matrix and the
 * owner wildcard behavior.
 *
 * Role hierarchy (most → least power):
 *   owner > admin > editor > viewer
 *
 * Owners have "*" (wildcard) so any permission check passes.
 */
import { describe, it, expect } from "vitest";
import {
  hasPermission,
  canExecuteAgent,
  canManageTeam,
  canEditSettings,
  canCreateWorkflow,
  canViewBilling,
  canConfigureAgent,
  PERMISSIONS,
  ROLE_META,
  ASSIGNABLE_ROLES,
  ALL_ROLES,
  type Role,
} from "@/lib/rbac";

describe("hasPermission", () => {
  describe("owner wildcard", () => {
    it("grants owner access to any permission", () => {
      expect(hasPermission("owner", "agents.execute")).toBe(true);
      expect(hasPermission("owner", "team.manage")).toBe(true);
      expect(hasPermission("owner", "billing.view")).toBe(true);
      expect(hasPermission("owner", "settings.edit")).toBe(true);
    });

    it("grants owner access even to made-up permissions (defensive)", () => {
      // A future permission we haven't written yet should still be allowed
      // for owners via the "*" wildcard
      expect(hasPermission("owner", "some.future.permission")).toBe(true);
      expect(hasPermission("owner", "")).toBe(true);
    });
  });

  describe("admin permissions", () => {
    it("grants admin the full suite of management permissions", () => {
      expect(hasPermission("admin", "agents.execute")).toBe(true);
      expect(hasPermission("admin", "agents.configure")).toBe(true);
      expect(hasPermission("admin", "team.manage")).toBe(true);
      expect(hasPermission("admin", "settings.edit")).toBe(true);
      expect(hasPermission("admin", "billing.view")).toBe(true);
    });

    it("rejects unknown permissions (admin has no wildcard)", () => {
      expect(hasPermission("admin", "some.future.permission")).toBe(false);
    });
  });

  describe("editor permissions", () => {
    it("grants editor execute + workflow create but not manage", () => {
      expect(hasPermission("editor", "agents.execute")).toBe(true);
      expect(hasPermission("editor", "workflows.create")).toBe(true);
      expect(hasPermission("editor", "settings.view")).toBe(true);
    });

    it("blocks editor from team management and billing", () => {
      expect(hasPermission("editor", "team.manage")).toBe(false);
      expect(hasPermission("editor", "billing.view")).toBe(false);
      expect(hasPermission("editor", "settings.edit")).toBe(false);
      expect(hasPermission("editor", "agents.configure")).toBe(false);
    });
  });

  describe("viewer permissions", () => {
    it("grants viewer read-only access", () => {
      expect(hasPermission("viewer", "agents.view")).toBe(true);
      expect(hasPermission("viewer", "workflows.view")).toBe(true);
      expect(hasPermission("viewer", "settings.view")).toBe(true);
      expect(hasPermission("viewer", "read")).toBe(true);
    });

    it("blocks viewer from ANY write/execute/manage action", () => {
      expect(hasPermission("viewer", "agents.execute")).toBe(false);
      expect(hasPermission("viewer", "agents.configure")).toBe(false);
      expect(hasPermission("viewer", "workflows.create")).toBe(false);
      expect(hasPermission("viewer", "team.manage")).toBe(false);
      expect(hasPermission("viewer", "settings.edit")).toBe(false);
      expect(hasPermission("viewer", "billing.view")).toBe(false);
      expect(hasPermission("viewer", "write")).toBe(false);
      expect(hasPermission("viewer", "delete")).toBe(false);
    });
  });

  describe("invalid roles", () => {
    it("returns false for an unrecognized role", () => {
      // Defensive — if a DB row somehow has an unknown role string
      expect(hasPermission("superuser" as Role, "agents.execute")).toBe(false);
      expect(hasPermission("" as Role, "agents.execute")).toBe(false);
    });
  });
});

describe("role-specific helper functions", () => {
  describe("canExecuteAgent", () => {
    it("owner/admin/editor can execute", () => {
      expect(canExecuteAgent("owner")).toBe(true);
      expect(canExecuteAgent("admin")).toBe(true);
      expect(canExecuteAgent("editor")).toBe(true);
    });

    it("viewer cannot execute", () => {
      expect(canExecuteAgent("viewer")).toBe(false);
    });
  });

  describe("canManageTeam", () => {
    it("only owner/admin can manage team", () => {
      expect(canManageTeam("owner")).toBe(true);
      expect(canManageTeam("admin")).toBe(true);
      expect(canManageTeam("editor")).toBe(false);
      expect(canManageTeam("viewer")).toBe(false);
    });
  });

  describe("canEditSettings", () => {
    it("only owner/admin can edit settings", () => {
      expect(canEditSettings("owner")).toBe(true);
      expect(canEditSettings("admin")).toBe(true);
      expect(canEditSettings("editor")).toBe(false);
      expect(canEditSettings("viewer")).toBe(false);
    });
  });

  describe("canCreateWorkflow", () => {
    it("owner/admin/editor can create workflows", () => {
      expect(canCreateWorkflow("owner")).toBe(true);
      expect(canCreateWorkflow("admin")).toBe(true);
      expect(canCreateWorkflow("editor")).toBe(true);
      expect(canCreateWorkflow("viewer")).toBe(false);
    });
  });

  describe("canViewBilling", () => {
    it("only owner/admin can view billing", () => {
      expect(canViewBilling("owner")).toBe(true);
      expect(canViewBilling("admin")).toBe(true);
      expect(canViewBilling("editor")).toBe(false);
      expect(canViewBilling("viewer")).toBe(false);
    });
  });

  describe("canConfigureAgent", () => {
    it("only owner/admin can configure agents (editor executes only)", () => {
      expect(canConfigureAgent("owner")).toBe(true);
      expect(canConfigureAgent("admin")).toBe(true);
      expect(canConfigureAgent("editor")).toBe(false);
      expect(canConfigureAgent("viewer")).toBe(false);
    });
  });
});

describe("role-hierarchy invariants", () => {
  // These tests protect the implicit assumption that permissions are nested.
  // If a permission check would "ratchet down" from admin to viewer, we want
  // it to trigger a review.
  const hierarchy: Role[] = ["owner", "admin", "editor", "viewer"];

  it("every permission that editor has, admin also has", () => {
    for (const perm of PERMISSIONS.editor) {
      expect(hasPermission("admin", perm)).toBe(true);
    }
  });

  it("every permission that viewer has, editor also has", () => {
    for (const perm of PERMISSIONS.viewer) {
      expect(hasPermission("editor", perm)).toBe(true);
    }
  });

  it("every permission that any lower role has, owner also has (via wildcard)", () => {
    for (const role of hierarchy) {
      for (const perm of PERMISSIONS[role]) {
        if (perm === "*") continue;
        expect(hasPermission("owner", perm)).toBe(true);
      }
    }
  });
});

describe("role metadata", () => {
  it("exports display metadata for every role", () => {
    const roles: Role[] = ["owner", "admin", "editor", "viewer"];
    for (const role of roles) {
      expect(ROLE_META[role]).toBeDefined();
      expect(ROLE_META[role].label.length).toBeGreaterThan(0);
      expect(ROLE_META[role].description.length).toBeGreaterThan(0);
      expect(ROLE_META[role].color).toMatch(/^text-/);
      expect(ROLE_META[role].bgColor).toMatch(/^bg-/);
      expect(ROLE_META[role].borderColor).toMatch(/^border-/);
    }
  });

  it("capitalizes role labels", () => {
    expect(ROLE_META.owner.label).toBe("Owner");
    expect(ROLE_META.admin.label).toBe("Admin");
    expect(ROLE_META.editor.label).toBe("Editor");
    expect(ROLE_META.viewer.label).toBe("Viewer");
  });
});

describe("role lists", () => {
  it("ASSIGNABLE_ROLES excludes owner (set at org creation only)", () => {
    expect(ASSIGNABLE_ROLES).not.toContain("owner");
    expect(ASSIGNABLE_ROLES).toContain("admin");
    expect(ASSIGNABLE_ROLES).toContain("editor");
    expect(ASSIGNABLE_ROLES).toContain("viewer");
    expect(ASSIGNABLE_ROLES).toHaveLength(3);
  });

  it("ALL_ROLES contains all 4 roles in power order", () => {
    expect(ALL_ROLES).toEqual(["owner", "admin", "editor", "viewer"]);
  });
});
