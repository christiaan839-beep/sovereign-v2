/**
 * Tests for src/lib/approval-gate.ts — high-risk action approval rules
 *
 * These tests encode the business rules that decide when an AI agent
 * must pause and wait for human approval. Changing thresholds here should
 * REQUIRE a deliberate update to the tests — silent rule weakening could
 * let agents send mass emails or spend money without confirmation.
 */
import { describe, it, expect } from "vitest";
import { requiresApproval, getApprovalRules } from "@/lib/approval-gate";

describe("requiresApproval", () => {
  describe("send_email", () => {
    it("does NOT require approval for small recipient counts (<=10)", () => {
      expect(requiresApproval("send_email", { recipientCount: 1 })).toBe(false);
      expect(requiresApproval("send_email", { recipientCount: 5 })).toBe(false);
      expect(requiresApproval("send_email", { recipientCount: 10 })).toBe(false);
    });

    it("requires approval when recipientCount > 10", () => {
      expect(requiresApproval("send_email", { recipientCount: 11 })).toBe(true);
      expect(requiresApproval("send_email", { recipientCount: 100 })).toBe(true);
      expect(requiresApproval("send_email", { recipientCount: 10000 })).toBe(true);
    });

    it("does NOT require approval when recipientCount is missing (treats as 0)", () => {
      expect(requiresApproval("send_email", {})).toBe(false);
      expect(requiresApproval("send_email")).toBe(false);
    });
  });

  describe("make_call", () => {
    it("ALWAYS requires approval, regardless of context", () => {
      expect(requiresApproval("make_call")).toBe(true);
      expect(requiresApproval("make_call", {})).toBe(true);
      expect(requiresApproval("make_call", { phoneNumber: "+1234" })).toBe(true);
      expect(requiresApproval("make_call", { cost: 0 })).toBe(true);
    });
  });

  describe("deploy_code", () => {
    it("ALWAYS requires approval", () => {
      expect(requiresApproval("deploy_code")).toBe(true);
      expect(requiresApproval("deploy_code", {})).toBe(true);
      expect(requiresApproval("deploy_code", { env: "staging" })).toBe(true);
      expect(requiresApproval("deploy_code", { env: "production" })).toBe(true);
    });
  });

  describe("spend_money", () => {
    it("does NOT require approval for small amounts (<=100)", () => {
      expect(requiresApproval("spend_money", { amount: 1 })).toBe(false);
      expect(requiresApproval("spend_money", { amount: 50 })).toBe(false);
      expect(requiresApproval("spend_money", { amount: 100 })).toBe(false);
    });

    it("requires approval when amount > 100", () => {
      expect(requiresApproval("spend_money", { amount: 101 })).toBe(true);
      expect(requiresApproval("spend_money", { amount: 500 })).toBe(true);
      expect(requiresApproval("spend_money", { amount: 100000 })).toBe(true);
    });

    it("does NOT require approval when amount is missing (treats as 0)", () => {
      expect(requiresApproval("spend_money", {})).toBe(false);
      expect(requiresApproval("spend_money")).toBe(false);
    });
  });

  describe("delete_data", () => {
    it("ALWAYS requires approval", () => {
      expect(requiresApproval("delete_data")).toBe(true);
      expect(requiresApproval("delete_data", {})).toBe(true);
      expect(requiresApproval("delete_data", { count: 0 })).toBe(true);
      expect(requiresApproval("delete_data", { count: 1 })).toBe(true);
    });
  });
});

describe("getApprovalRules", () => {
  it("returns all 5 rules", () => {
    const rules = getApprovalRules();
    expect(rules).toHaveLength(5);
  });

  it("includes all five known actions", () => {
    const rules = getApprovalRules();
    const actions = rules.map((r) => r.action).sort();
    expect(actions).toEqual(
      ["delete_data", "deploy_code", "make_call", "send_email", "spend_money"].sort()
    );
  });

  it("provides a human-readable rule for each action", () => {
    const rules = getApprovalRules();
    for (const rule of rules) {
      expect(rule.rule.length).toBeGreaterThan(0);
      expect(typeof rule.rule).toBe("string");
    }
  });

  it("documents the email threshold consistent with the check logic", () => {
    const rule = getApprovalRules().find((r) => r.action === "send_email");
    expect(rule?.rule).toMatch(/10/);
  });

  it("documents the spend threshold consistent with the check logic", () => {
    const rule = getApprovalRules().find((r) => r.action === "spend_money");
    expect(rule?.rule).toMatch(/100/);
  });
});
