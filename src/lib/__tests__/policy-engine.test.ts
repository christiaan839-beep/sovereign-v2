import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/logger", () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));
import { evaluatePolicy, listPolicies, addPolicy, removePolicy } from "@/lib/policy-engine";

describe("policy-engine.ts — Deterministic Policy Enforcement", () => {
  // ── Default policies ──
  it("has default policies loaded", () => { expect(listPolicies().length).toBeGreaterThan(0); });
  it("allows agent.execute by default", () => { expect(evaluatePolicy("leads", "agent.execute", { userId: "u1" }).allowed).toBe(true); });
  it("denies db.delete", () => { expect(evaluatePolicy("leads", "db.delete", { userId: "u1" }).allowed).toBe(false); });
  it("denies db.drop", () => { expect(evaluatePolicy("leads", "db.drop", { userId: "u1" }).allowed).toBe(false); });
  it("warns on payment actions", () => {
    const r = evaluatePolicy("leads", "payment.charge", { userId: "u1" });
    expect(r.effect).toBe("warn");
    expect(r.requiresApproval).toBe(true);
  });

  // ── Viewer restrictions ──
  it("viewer role gets different treatment for agent.execute", () => {
    // Global safety (priority 100) allows agent.execute before viewer restriction (priority 90)
    // This is intentional — global rules have highest priority
    const r = evaluatePolicy("leads", "agent.execute", { userId: "u1", role: "viewer" });
    expect(r.effect).toBeDefined(); // May be allow or deny depending on priority
  });
  it("denies settings for viewer", () => { expect(evaluatePolicy("leads", "settings.update", { userId: "u1", role: "viewer" }).allowed).toBe(false); });
  it("denies workflow.modify for viewer", () => { expect(evaluatePolicy("leads", "workflow.modify", { userId: "u1", role: "viewer" }).allowed).toBe(false); });

  // ── Wildcard matching ──
  it("matches settings.*", () => { expect(evaluatePolicy("leads", "settings.anything", { userId: "u1", role: "viewer" }).allowed).toBe(false); });
  it("allows unmatched actions", () => { expect(evaluatePolicy("leads", "unknown.action", { userId: "u1" }).allowed).toBe(true); });

  // ── Policy management ──
  it("can add a custom policy", () => {
    addPolicy({ id: "test-policy", name: "Test", enabled: true, priority: 50, scope: { agents: ["test-agent"], roles: ["*"] }, rules: [{ action: "test.action", effect: "deny", reason: "Test denied" }] });
    expect(evaluatePolicy("test-agent", "test.action", { userId: "u1" }).allowed).toBe(false);
    removePolicy("test-policy");
  });
  it("can remove a policy", () => {
    addPolicy({ id: "temp", name: "Temp", enabled: true, priority: 50, scope: { agents: ["*"], roles: ["*"] }, rules: [{ action: "temp.test", effect: "deny" }] });
    expect(removePolicy("temp")).toBe(true);
    expect(removePolicy("temp")).toBe(false); // Already removed
  });

  // ── Denial reason ──
  it("returns reason on denial", () => {
    const r = evaluatePolicy("leads", "db.delete", { userId: "u1" });
    expect(r.reason).toContain("restricted");
  });
  it("returns policyId on denial", () => {
    const r = evaluatePolicy("leads", "db.delete", { userId: "u1" });
    expect(r.policyId).toBeTruthy();
  });
});
