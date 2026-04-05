/**
 * Tests for src/lib/action-tiers.ts — the 3-tier agent permission system
 *
 * Tier rules (in enforcement order):
 *   Tier 3 (restricted)  — voice-closer, computer-use, whitelabel. Admin approval.
 *   Tier 2 (confirm)     — blog-gen, email-sequence, leads, seo, content,
 *                           ad-report, proposal-generator. User confirmation.
 *   Tier 1 (autonomous)  — everything else (including unknown agents).
 *
 * These tests lock the agent→tier mapping so accidentally promoting a
 * destructive agent to Tier 1 would fail loudly. The backward-compat
 * default of Tier 1 for unknown agents is also tested.
 */
import { describe, it, expect } from "vitest";
import {
  getActionTier,
  buildConfirmResponse,
  buildRestrictedResponse,
  TIER_LABELS,
} from "@/lib/action-tiers";

describe("getActionTier", () => {
  describe("Tier 3 (Restricted / Admin approval)", () => {
    it("classifies voice-closer as Tier 3 with phone-call reason", () => {
      const tier = getActionTier("voice-closer");
      expect(tier.tier).toBe(3);
      expect(tier.requiresConfirmation).toBe(true);
      expect(tier.description).toContain("phone calls");
    });

    it("classifies computer-use as Tier 3 with browser-control reason", () => {
      const tier = getActionTier("computer-use");
      expect(tier.tier).toBe(3);
      expect(tier.requiresConfirmation).toBe(true);
      expect(tier.description).toContain("browser");
    });

    it("classifies whitelabel as Tier 3 with domain-config reason", () => {
      const tier = getActionTier("whitelabel");
      expect(tier.tier).toBe(3);
      expect(tier.requiresConfirmation).toBe(true);
      expect(tier.description).toContain("domain");
    });

    it("uses the correct Tier 3 label", () => {
      expect(getActionTier("voice-closer").label).toBe("Admin Approval Required");
    });
  });

  describe("Tier 2 (Confirm / User approval)", () => {
    const tier2Agents = [
      "blog-gen",
      "email-sequence",
      "leads",
      "seo",
      "content",
      "ad-report",
      "proposal-generator",
    ];

    it.each(tier2Agents)("classifies %s as Tier 2 (requires confirmation)", (name) => {
      const tier = getActionTier(name);
      expect(tier.tier).toBe(2);
      expect(tier.requiresConfirmation).toBe(true);
    });

    it("uses the correct Tier 2 label", () => {
      expect(getActionTier("leads").label).toBe("Requires Confirmation");
    });

    it("describes Tier 2 as 'writes data or sends content'", () => {
      const tier = getActionTier("blog-gen");
      expect(tier.description.toLowerCase()).toMatch(/writes data|sends content/);
    });
  });

  describe("Tier 1 (Autonomous / No confirmation)", () => {
    const tier1Agents = ["smart-router", "deep-think", "vision", "embed", "rerank", "translate", "ocr"];

    it.each(tier1Agents)("classifies %s as Tier 1 (no confirmation)", (name) => {
      const tier = getActionTier(name);
      expect(tier.tier).toBe(1);
      expect(tier.requiresConfirmation).toBe(false);
    });

    it("uses the correct Tier 1 label", () => {
      expect(getActionTier("vision").label).toBe("Autonomous");
    });

    it("describes Tier 1 as 'read-only' and 'executes immediately'", () => {
      const tier = getActionTier("embed");
      expect(tier.description.toLowerCase()).toContain("read-only");
      expect(tier.description.toLowerCase()).toContain("executes immediately");
    });
  });

  describe("unknown agents", () => {
    it("defaults unknown agents to Tier 1 (backward compatibility)", () => {
      const tier = getActionTier("some-brand-new-agent-2099");
      expect(tier.tier).toBe(1);
      expect(tier.requiresConfirmation).toBe(false);
    });

    it("defaults empty-string agent name to Tier 1", () => {
      const tier = getActionTier("");
      expect(tier.tier).toBe(1);
    });
  });

  describe("CRITICAL: no destructive agent leaks to Tier 1", () => {
    // If someone accidentally removes voice-closer from the TIER_3 set,
    // this test will catch it — outbound phone calls require admin approval
    it("voice-closer NEVER falls through to Tier 1", () => {
      const tier = getActionTier("voice-closer");
      expect(tier.tier).not.toBe(1);
      expect(tier.requiresConfirmation).toBe(true);
    });

    it("computer-use NEVER falls through to Tier 1 or 2", () => {
      const tier = getActionTier("computer-use");
      expect(tier.tier).toBe(3);
    });

    it("whitelabel NEVER falls through to Tier 1", () => {
      const tier = getActionTier("whitelabel");
      expect(tier.tier).not.toBe(1);
    });
  });
});

describe("buildConfirmResponse", () => {
  it("produces a Tier 2 confirm payload with preview + confirmUrl", () => {
    const preview = { subject: "Test email", body: "..." };
    const resp = buildConfirmResponse("email-sequence", preview);
    expect(resp.tier).toBe("confirm");
    expect(resp.label).toBe(TIER_LABELS[2]);
    expect(resp.preview).toEqual(preview);
    expect(resp.confirmUrl).toBe("/api/agents/email-sequence/confirm");
    expect(resp.message).toContain("confirmed: true");
  });

  it("embeds the agent name in the confirm URL", () => {
    const resp = buildConfirmResponse("leads", {});
    expect(resp.confirmUrl).toBe("/api/agents/leads/confirm");
  });

  it("handles empty preview object", () => {
    const resp = buildConfirmResponse("blog-gen", {});
    expect(resp.preview).toEqual({});
    expect(resp.tier).toBe("confirm");
  });
});

describe("buildRestrictedResponse", () => {
  it("produces a Tier 3 restricted payload with admin-required reason", () => {
    const resp = buildRestrictedResponse("voice-closer");
    expect(resp.tier).toBe("restricted");
    expect(resp.label).toBe(TIER_LABELS[3]);
    expect(resp.requiresAdmin).toBe(true);
    expect(resp.reason).toContain("phone calls");
    expect(resp.message).toContain("Admin approval");
  });

  it("produces a Tier 3 payload even for Tier 1 agents (defensive default message)", () => {
    // buildRestrictedResponse fetches tier info via getActionTier, so unknown
    // agents get the fallback "This action requires admin approval" description
    // NOTE: the function routes through getActionTier → tier 1 → description
    //       "Read-only operation. Executes immediately."
    // So this documents actual current behavior rather than enforcing a guarantee
    const resp = buildRestrictedResponse("deep-think");
    expect(resp.tier).toBe("restricted");
    expect(resp.requiresAdmin).toBe(true);
  });

  it("includes the specific Tier 3 reason for each restricted agent", () => {
    expect(buildRestrictedResponse("computer-use").reason).toContain("browser");
    expect(buildRestrictedResponse("whitelabel").reason).toContain("domain");
  });
});

describe("TIER_LABELS", () => {
  it("exports all 3 tier labels", () => {
    expect(TIER_LABELS[1]).toBe("Autonomous");
    expect(TIER_LABELS[2]).toBe("Requires Confirmation");
    expect(TIER_LABELS[3]).toBe("Admin Approval Required");
  });
});
