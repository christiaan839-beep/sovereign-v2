/**
 * Tests for src/lib/audit-subscription-store.ts — Cook 91.
 *
 *   - createSubscription requires tenantId, deliverTo, frameworks
 *   - listSubscriptionsForTenant is scoped
 *   - pause/resume flip the active flag
 *   - delete removes + reports false on missing
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  _resetForTests,
  createSubscription,
  deleteSubscription,
  getSubscription,
  listActiveSubscriptions,
  listSubscriptionsForTenant,
  pauseSubscription,
  resumeSubscription,
} from "../audit-subscription-store";

function base() {
  return {
    tenantId: "tenant-1",
    tenantDisplayName: "Acme",
    deliverTo: ["compliance@acme.example"],
    cadence: "monthly" as const,
    frameworks: ["eu-ai-act-annex-iv" as const],
    active: true,
  };
}

beforeEach(() => {
  _resetForTests();
});

describe("createSubscription", () => {
  it("creates a record with an id prefix", () => {
    const s = createSubscription(base());
    expect(s.id.startsWith("sub_")).toBe(true);
    expect(s.tenantId).toBe("tenant-1");
  });

  it("rejects empty tenantId / deliverTo / frameworks", () => {
    expect(() => createSubscription({ ...base(), tenantId: "" })).toThrow();
    expect(() => createSubscription({ ...base(), deliverTo: [] })).toThrow();
    expect(() => createSubscription({ ...base(), frameworks: [] })).toThrow();
  });
});

describe("listSubscriptionsForTenant", () => {
  it("returns only the requested tenant's subs", () => {
    createSubscription(base());
    createSubscription({ ...base(), tenantId: "tenant-2" });
    createSubscription({ ...base(), cadence: "quarterly" });
    expect(listSubscriptionsForTenant("tenant-1").length).toBe(2);
    expect(listSubscriptionsForTenant("tenant-2").length).toBe(1);
  });
});

describe("listActiveSubscriptions", () => {
  it("filters paused subs out", () => {
    const a = createSubscription(base());
    createSubscription({ ...base(), tenantId: "tenant-2" });
    pauseSubscription(a.id);
    const active = listActiveSubscriptions();
    expect(active.length).toBe(1);
    expect(active[0].tenantId).toBe("tenant-2");
  });
});

describe("pause/resume", () => {
  it("flips the active flag", () => {
    const s = createSubscription(base());
    expect(pauseSubscription(s.id)?.active).toBe(false);
    expect(resumeSubscription(s.id)?.active).toBe(true);
  });

  it("returns undefined for missing id", () => {
    expect(pauseSubscription("missing")).toBeUndefined();
  });
});

describe("deleteSubscription", () => {
  it("removes the sub and returns true", () => {
    const s = createSubscription(base());
    expect(deleteSubscription(s.id)).toBe(true);
    expect(getSubscription(s.id)).toBeUndefined();
  });

  it("returns false on missing id", () => {
    expect(deleteSubscription("missing")).toBe(false);
  });
});
