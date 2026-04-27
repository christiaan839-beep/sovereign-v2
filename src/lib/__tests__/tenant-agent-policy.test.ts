import { describe, it, expect } from "vitest";
import {
  evaluateTenantPolicy,
  healthcareTemplate,
  financeTemplate,
} from "@/lib/tenant-agent-policy";
import type { AgentManifest } from "@/lib/agent-manifest";

const tier1Vanilla = (): AgentManifest => ({
  slug: "vanilla-1",
  tier: 1,
  tierReason: "read-only",
  models: [{ provider: "anthropic", inferenceFn: "ai" }],
  tools: [],
  pii: { guardMode: "default-mask", handlesByDesign: false },
  outputClass: "tenant-private",
  signals: [{ kind: "model_call" }],
  classifierConfidence: 0.9,
});

const tier3Browser = (): AgentManifest => ({
  ...tier1Vanilla(),
  slug: "computer-use",
  tier: 3,
  signals: [{ kind: "browser_control" }, { kind: "model_call" }],
});

const tier2Outbound = (): AgentManifest => ({
  ...tier1Vanilla(),
  slug: "voice-closer",
  tier: 2,
  signals: [{ kind: "voice_call" }, { kind: "external_fetch" }],
});

describe("evaluateTenantPolicy", () => {
  it("allow-all permits everything", () => {
    const r = evaluateTenantPolicy(tier3Browser(), { mode: "allow-all" });
    expect(r.allowed).toBe(true);
  });

  it("null/undefined policy = allow-all", () => {
    expect(evaluateTenantPolicy(tier3Browser(), null).allowed).toBe(true);
    expect(evaluateTenantPolicy(tier3Browser(), undefined).allowed).toBe(true);
  });

  it("maxTier blocks higher tiers", () => {
    const r = evaluateTenantPolicy(tier3Browser(), {
      mode: "allow-all",
      maxTier: 2,
    });
    expect(r.allowed).toBe(false);
    expect(r.rule).toBe("max_tier");
  });

  it("forbidCapabilities blocks an agent that uses one", () => {
    const r = evaluateTenantPolicy(tier3Browser(), {
      mode: "allow-all",
      forbidCapabilities: ["browser_control"],
    });
    expect(r.allowed).toBe(false);
    expect(r.rule).toBe("forbid_capability");
    expect(r.reason).toContain("browser_control");
  });

  it("forbidProviders blocks an agent that uses one", () => {
    const r = evaluateTenantPolicy(tier1Vanilla(), {
      mode: "allow-all",
      forbidProviders: ["anthropic"],
    });
    expect(r.allowed).toBe(false);
    expect(r.rule).toBe("forbid_provider");
  });

  it("forbidOutputClass blocks an agent matching the class", () => {
    const r = evaluateTenantPolicy(
      { ...tier1Vanilla(), outputClass: "public" },
      { mode: "allow-all", forbidOutputClass: ["public"] },
    );
    expect(r.allowed).toBe(false);
    expect(r.rule).toBe("forbid_output_class");
  });

  it("allow-list mode: agent in list is allowed", () => {
    const r = evaluateTenantPolicy(tier1Vanilla(), {
      mode: "allow-list",
      allowedSlugs: ["vanilla-1", "other"],
    });
    expect(r.allowed).toBe(true);
  });

  it("allow-list mode: agent NOT in list is denied", () => {
    const r = evaluateTenantPolicy(tier1Vanilla(), {
      mode: "allow-list",
      allowedSlugs: ["different"],
    });
    expect(r.allowed).toBe(false);
    expect(r.rule).toBe("not_in_allowlist");
  });

  it("deny-list mode: agent NOT in list is allowed", () => {
    const r = evaluateTenantPolicy(tier1Vanilla(), {
      mode: "deny-list",
      deniedSlugs: ["other"],
    });
    expect(r.allowed).toBe(true);
  });

  it("deny-list mode: agent in list is denied", () => {
    const r = evaluateTenantPolicy(tier1Vanilla(), {
      mode: "deny-list",
      deniedSlugs: ["vanilla-1"],
    });
    expect(r.allowed).toBe(false);
    expect(r.rule).toBe("in_denylist");
  });

  it("templates: healthcare blocks browser_control + voice_call", () => {
    const policy = healthcareTemplate();
    expect(evaluateTenantPolicy(tier3Browser(), policy).allowed).toBe(false);
    expect(evaluateTenantPolicy(tier2Outbound(), policy).allowed).toBe(false);
    expect(evaluateTenantPolicy(tier1Vanilla(), policy).allowed).toBe(true);
  });

  it("templates: finance is even tighter (max-tier 1, blocks external_fetch)", () => {
    const policy = financeTemplate();
    expect(evaluateTenantPolicy(tier3Browser(), policy).allowed).toBe(false);
    expect(evaluateTenantPolicy(tier2Outbound(), policy).allowed).toBe(false);
    expect(evaluateTenantPolicy(tier1Vanilla(), policy).allowed).toBe(true);
  });
});
