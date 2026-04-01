import { describe, test, expect } from "vitest";
import { requireTenantId, requireUserId, guardTenantAccess, belongsToTenant } from "@/lib/tenant-scope";
import type { AgentContext } from "@/lib/agent-factory";

function makeCtx(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    input: {},
    request: new Request("http://localhost"),
    email: "test@example.com",
    userId: "user_123",
    tenantId: "tenant_uuid_456",
    orgId: undefined,
    ...overrides,
  };
}

describe("requireTenantId", () => {
  test("returns tenantId when present", () => {
    const ctx = makeCtx({ tenantId: "t-abc" });
    expect(requireTenantId(ctx)).toBe("t-abc");
  });

  test("throws when tenantId is undefined", () => {
    const ctx = makeCtx({ tenantId: undefined });
    expect(() => requireTenantId(ctx)).toThrow("Tenant context required");
  });
});

describe("requireUserId", () => {
  test("returns userId when present", () => {
    const ctx = makeCtx({ userId: "u-xyz" });
    expect(requireUserId(ctx)).toBe("u-xyz");
  });

  test("throws when userId is empty", () => {
    const ctx = makeCtx({ userId: "" });
    expect(() => requireUserId(ctx)).toThrow("Authentication required");
  });
});

describe("guardTenantAccess", () => {
  test("returns denied=false with tenantId when present", () => {
    const result = guardTenantAccess({ tenantId: "t-abc", userId: "u-1" });
    expect(result.denied).toBe(false);
    if (!result.denied) {
      expect(result.tenantId).toBe("t-abc");
    }
  });

  test("returns denied=true with 403 response when tenantId missing", () => {
    const result = guardTenantAccess({ tenantId: undefined, userId: "u-1" });
    expect(result.denied).toBe(true);
    if (result.denied) {
      expect(result.response.status).toBe(403);
    }
  });
});

describe("belongsToTenant", () => {
  test("returns true when resource belongs to user tenant", () => {
    expect(belongsToTenant("t-abc", "t-abc")).toBe(true);
  });

  test("returns false when resource belongs to different tenant", () => {
    expect(belongsToTenant("t-abc", "t-xyz")).toBe(false);
  });

  test("returns false when resource tenantId is null", () => {
    expect(belongsToTenant(null, "t-abc")).toBe(false);
  });

  test("returns false when resource tenantId is undefined", () => {
    expect(belongsToTenant(undefined, "t-abc")).toBe(false);
  });

  test("returns false when user tenantId is empty", () => {
    expect(belongsToTenant("t-abc", "")).toBe(false);
  });
});
