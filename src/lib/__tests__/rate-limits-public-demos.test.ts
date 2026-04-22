/**
 * rate-limits.ts — per-endpoint rules for landing v2 public demo endpoints.
 *
 * These rules sit BEFORE the generic /api/public/ rule in the RULES
 * array so that first-match-wins routes each demo-specific prefix to
 * its own tighter bucket instead of the public-default 120/min.
 */

import { describe, it, expect } from "vitest";
import { matchRule } from "@/lib/rate-limits";

describe("rate-limit rules — landing v2 public demo endpoints", () => {
  it("router-demo matches its own rule with max=5/hour/IP", () => {
    const rule = matchRule("/api/public/router-demo");
    expect(rule?.name).toBe("public-router-demo");
    expect(rule?.max).toBe(5);
    expect(rule?.windowSeconds).toBe(3600);
    expect(rule?.identify).toBe("ip_only");
  });

  it("verify-demo matches its own rule with max=5/hour/IP", () => {
    const rule = matchRule("/api/public/verify-demo");
    expect(rule?.name).toBe("public-verify-demo");
    expect(rule?.max).toBe(5);
    expect(rule?.windowSeconds).toBe(3600);
  });

  it("memory-demo matches its own rule with max=10/hour/IP", () => {
    const rule = matchRule("/api/public/memory-demo");
    expect(rule?.name).toBe("public-memory-demo");
    expect(rule?.max).toBe(10);
    expect(rule?.windowSeconds).toBe(3600);
  });

  it("agent-builder-demo matches its own rule with max=3/hour/IP (tightest cap)", () => {
    const rule = matchRule("/api/public/agent-builder-demo");
    expect(rule?.name).toBe("public-agent-builder-demo");
    expect(rule?.max).toBe(3);
    expect(rule?.windowSeconds).toBe(3600);
    expect(rule?.identify).toBe("ip_only");
  });

  it("playbook-builder-demo matches its own rule with max=3/hour/IP", () => {
    const rule = matchRule("/api/public/playbook-builder-demo");
    expect(rule?.name).toBe("public-playbook-builder-demo");
    expect(rule?.max).toBe(3);
    expect(rule?.windowSeconds).toBe(3600);
    expect(rule?.identify).toBe("ip_only");
  });

  it("catalog (cheap) falls through to the generic public rule", () => {
    const rule = matchRule("/api/public/catalog");
    expect(rule?.name).toBe("public");
    expect(rule?.max).toBe(120);
  });

  it("atlas-edges (cheap) falls through to the generic public rule", () => {
    const rule = matchRule("/api/public/atlas-edges");
    expect(rule?.name).toBe("public");
  });

  it("recent-runs (cheap) falls through to the generic public rule", () => {
    const rule = matchRule("/api/public/recent-runs");
    expect(rule?.name).toBe("public");
  });

  it("demo rules are all per-IP (no user-identity requirement)", () => {
    expect(matchRule("/api/public/router-demo")?.identify).toBe("ip_only");
    expect(matchRule("/api/public/verify-demo")?.identify).toBe("ip_only");
    expect(matchRule("/api/public/memory-demo")?.identify).toBe("ip_only");
  });
});
