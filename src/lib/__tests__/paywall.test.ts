import { describe, it, expect } from "vitest";
import { checkAgentAccess, checkFeatureAccess, getAvailableAgents, getLockedFeatures } from "@/lib/paywall";
import { AGENT_SLUGS } from "@/lib/agent-slugs";

describe("paywall.ts — Plan Gating", () => {
  // ── Free tier ──
  it("free: allows leads", () => { expect(checkAgentAccess("leads", "free").allowed).toBe(true); });
  it("free: allows blog-gen", () => { expect(checkAgentAccess("blog-gen", "free").allowed).toBe(true); });
  it("free: allows seo-dominator", () => { expect(checkAgentAccess("seo-dominator", "free").allowed).toBe(true); });
  it("free: blocks email-sequence", () => { expect(checkAgentAccess("email-sequence", "free").allowed).toBe(false); });
  it("free: blocks competitor-scan", () => { expect(checkAgentAccess("competitor-scan", "free").allowed).toBe(false); });
  it("free: blocks voice agents", () => { expect(checkAgentAccess("voice-closer", "free").allowed).toBe(false); });
  it("free: returns upgrade URL", () => { expect(checkAgentAccess("voice-closer", "free").upgradeUrl).toBe("/dashboard/billing"); });
  it("free: returns required plan", () => { expect(checkAgentAccess("voice-closer", "free").requiredPlan).toBeTruthy(); });
  it("free: gets 3 agents", () => { expect(getAvailableAgents("free").total).toBe(3); });
  it("free: locks every agent it does not grant", () => {
    const free = getAvailableAgents("free");
    expect(free.locked).toBe(AGENT_SLUGS.length - free.total);
  });

  // ── Starter tier ──
  it("starter: allows email-sequence", () => { expect(checkAgentAccess("email-sequence", "starter").allowed).toBe(true); });
  it("starter: allows organic-content", () => { expect(checkAgentAccess("organic-content", "starter").allowed).toBe(true); });
  it("starter: blocks competitor-scan", () => { expect(checkAgentAccess("competitor-scan", "starter").allowed).toBe(false); });
  it("starter: gets 5 agents", () => { expect(getAvailableAgents("starter").total).toBe(5); });

  // ── Array tier ──
  it("array: allows competitor-scan", () => { expect(checkAgentAccess("competitor-scan", "array").allowed).toBe(true); });
  it("array: allows brand-voice", () => { expect(checkAgentAccess("brand-voice", "array").allowed).toBe(true); });
  it("array: allows proposal-generator", () => { expect(checkAgentAccess("proposal-generator", "array").allowed).toBe(true); });
  it("array: blocks random agent (needs node)", () => { expect(checkAgentAccess("cosmos-video", "array").allowed).toBe(false); });
  it("array: gets 10 agents", () => { expect(getAvailableAgents("array").total).toBe(10); });

  // ── Node tier ──
  it("node: allows ALL agents", () => { expect(checkAgentAccess("cosmos-video", "node").allowed).toBe(true); });
  it("node: allows voice-closer", () => { expect(checkAgentAccess("voice-closer", "node").allowed).toBe(true); });
  it("node: gets every agent that exists", () => {
    // Was pinned to 129 while the platform shipped 140 — the paid tier
    // under-reported what the customer bought. Tie it to the generated list.
    expect(getAvailableAgents("node").total).toBe(AGENT_SLUGS.length);
  });
  it("node: zero locked", () => { expect(getAvailableAgents("node").locked).toBe(0); });

  // ── Enterprise tier ──
  it("enterprise: allows everything", () => { expect(checkAgentAccess("anything", "enterprise").allowed).toBe(true); });
  it("enterprise: zero locked", () => { expect(getAvailableAgents("enterprise").locked).toBe(0); });

  // ── Founder tier ──
  it("founder: allows everything (enterprise-level)", () => { expect(checkAgentAccess("anything", "founder").allowed).toBe(true); });

  // ── Feature gates ──
  it("free: blocks white-label", () => { expect(checkFeatureAccess("white-label", "free").allowed).toBe(false); });
  it("free: blocks api-access", () => { expect(checkFeatureAccess("api-access", "free").allowed).toBe(false); });
  it("starter: allows scheduled-runs", () => { expect(checkFeatureAccess("scheduled-runs", "starter").allowed).toBe(true); });
  it("starter: allows graph-memory", () => { expect(checkFeatureAccess("graph-memory", "starter").allowed).toBe(true); });
  it("array: allows api-access", () => { expect(checkFeatureAccess("api-access", "array").allowed).toBe(true); });
  it("array: allows workflow-builder", () => { expect(checkFeatureAccess("workflow-builder", "array").allowed).toBe(true); });
  it("node: allows voice-agents", () => { expect(checkFeatureAccess("voice-agents", "node").allowed).toBe(true); });
  it("enterprise: allows white-label", () => { expect(checkFeatureAccess("white-label", "enterprise").allowed).toBe(true); });
  it("enterprise: allows team-members", () => { expect(checkFeatureAccess("team-members", "enterprise").allowed).toBe(true); });
  it("unknown feature: allowed by default", () => { expect(checkFeatureAccess("nonexistent", "free").allowed).toBe(true); });

  // ── Locked features ──
  it("free: has many locked features", () => { expect(getLockedFeatures("free").length).toBeGreaterThan(5); });
  it("enterprise: has zero locked features", () => { expect(getLockedFeatures("enterprise").length).toBe(0); });

  // ── Legacy plan names ──
  it("pro maps to node (all agents)", () => { expect(checkAgentAccess("cosmos-video", "pro").allowed).toBe(true); });
  it("null maps to free", () => { expect(checkAgentAccess("email-sequence", null).allowed).toBe(false); });
  it("undefined maps to free", () => { expect(checkAgentAccess("email-sequence", undefined).allowed).toBe(false); });
});
