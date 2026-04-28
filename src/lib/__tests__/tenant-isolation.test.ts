/**
 * tenant-isolation — regression tests.
 *
 * Verifies the platform's "tenant A cannot see tenant B" claim with
 * pure-function assertions on the helpers in tenant-scope.ts.
 *
 * The full HTTP-route isolation (every /api/* endpoint scopes its
 * queries by user_id / tenant_id) is verified by the 200+ integration
 * tests that exercise specific routes. THIS file is the unit-level
 * gate: if `belongsToTenant` ever changes shape, the higher-level
 * tests get earlier feedback than a full request smoke-test.
 *
 * Why this matters: Round 23's IDOR sweep found two routes
 * (`/api/audit-logs`, `/api/organizations`) that returned data
 * across tenant boundaries. Those bugs would have been impossible
 * if `belongsToTenant` was used universally — these tests harden
 * the helper so a future refactor can't silently weaken it.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  belongsToTenant,
  guardTenantAccess,
  requireTenantId,
  requireUserId,
  PUBLIC_DEMO_USER_ID,
  isPublicDemoUser,
} from "../tenant-scope";

const tenantA = "tenant_aaaa";
const tenantB = "tenant_bbbb";
const userA = "user_alpha";

describe("tenant-isolation — belongsToTenant", () => {
  it("matches when both tenant ids equal", () => {
    expect(belongsToTenant(tenantA, tenantA)).toBe(true);
  });

  it("rejects when tenant ids differ (the IDOR case)", () => {
    expect(belongsToTenant(tenantA, tenantB)).toBe(false);
    expect(belongsToTenant(tenantB, tenantA)).toBe(false);
  });

  it("rejects when resource has no tenantId (orphan record)", () => {
    expect(belongsToTenant(null, tenantA)).toBe(false);
    expect(belongsToTenant(undefined, tenantA)).toBe(false);
    expect(belongsToTenant("", tenantA)).toBe(false);
  });

  it("rejects when user has no tenantId (unauthenticated)", () => {
    expect(belongsToTenant(tenantA, "")).toBe(false);
  });

  it("CRITICAL: never returns true on bare equality of falsy values", () => {
    // The classic JS bug: `null == null` → true with loose equality.
    // belongsToTenant must NOT consider two missing ids as a match.
    expect(belongsToTenant(null, null as unknown as string)).toBe(false);
    expect(belongsToTenant(undefined, undefined as unknown as string)).toBe(false);
    expect(belongsToTenant("", "")).toBe(false);
  });

  it("type-safe — strings only, no coercion", () => {
    // 0 should never be treated as equal to "0" or empty.
    expect(belongsToTenant(0 as unknown as string, "0")).toBe(false);
  });
});

describe("tenant-isolation — guardTenantAccess", () => {
  it("returns denied with 403 response when tenantId missing", () => {
    const result = guardTenantAccess({ userId: userA });
    expect(result.denied).toBe(true);
    if (result.denied) {
      expect(result.response.status).toBe(403);
    }
  });

  it("returns granted access when tenantId present", () => {
    const result = guardTenantAccess({ userId: userA, tenantId: tenantA });
    expect(result.denied).toBe(false);
    if (!result.denied) {
      expect(result.tenantId).toBe(tenantA);
    }
  });

  it("never grants empty tenantId as valid", () => {
    const result = guardTenantAccess({ userId: userA, tenantId: "" });
    // Empty string is falsy; must be treated as missing.
    expect(result.denied).toBe(true);
  });
});

describe("tenant-isolation — requireTenantId / requireUserId", () => {
  it("requireTenantId throws on missing context", () => {
    expect(() =>
      requireTenantId({ userId: userA, input: {}, request: new Request("http://x") } as never),
    ).toThrow(/Tenant context required/);
  });

  it("requireTenantId returns the id when present", () => {
    const ctx = {
      userId: userA,
      tenantId: tenantA,
      input: {},
      request: new Request("http://x"),
    } as never;
    expect(requireTenantId(ctx)).toBe(tenantA);
  });

  it("requireUserId throws on missing user", () => {
    expect(() =>
      requireUserId({ input: {}, request: new Request("http://x") } as never),
    ).toThrow(/Authentication required/);
  });
});

describe("tenant-isolation — public-demo isolation", () => {
  it("public demo user has a stable, distinguishable id", () => {
    expect(PUBLIC_DEMO_USER_ID).toBe("user_publicdemo");
    expect(isPublicDemoUser(PUBLIC_DEMO_USER_ID)).toBe(true);
  });

  it("real users are NEVER classified as public demo", () => {
    expect(isPublicDemoUser(userA)).toBe(false);
    expect(isPublicDemoUser("user_clerk_abc123")).toBe(false);
    expect(isPublicDemoUser(null)).toBe(false);
    expect(isPublicDemoUser(undefined)).toBe(false);
    expect(isPublicDemoUser("")).toBe(false);
  });

  it("public demo prefix is exact match (no prefix-collision)", () => {
    // A future user_id like "user_publicdemo_2" must NOT be confused
    // with the canonical demo user.
    expect(isPublicDemoUser("user_publicdemo_2")).toBe(false);
    expect(isPublicDemoUser("user_publicdemo_evil")).toBe(false);
    expect(isPublicDemoUser(PUBLIC_DEMO_USER_ID + " ")).toBe(false);
  });
});

/**
 * Cross-cutting invariant: the cost-runaway ledger MUST scope all
 * queries by user_id. We can't fully exercise the DB path here, but
 * we CAN verify the lib's exposed functions all take userId.
 */
describe("tenant-isolation — cost-runaway is user-scoped", () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
  });

  it("checkTenantCostCap takes userId (not tenantId — user-scoped ledger)", async () => {
    const { checkTenantCostCap } = await import("../cost-runaway");
    // Type-checked at compile time; assert at runtime by calling.
    const result = await checkTenantCostCap({
      userId: "u_a",
      planId: "free",
    });
    expect(result.capCents).toBeGreaterThan(0);
  });

  it("getTenantCostState takes userId", async () => {
    const { getTenantCostState } = await import("../cost-runaway");
    // Should not leak ledger across users — null when DB missing.
    const result = await getTenantCostState("u_a");
    expect(result).toBeNull();
  });

  it("unpauseTenant takes userId (operator action is user-scoped)", async () => {
    const { unpauseTenant } = await import("../cost-runaway");
    const result = await unpauseTenant({ userId: "u_a", reason: "test" });
    expect(result.unpaused).toBe(false); // No DB → no row → not unpaused
  });
});
