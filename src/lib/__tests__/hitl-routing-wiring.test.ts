/**
 * Move 21 — HITL routing wiring smoke tests.
 *
 * Confirms agent-factory imports + uses routeToHITL correctly.
 * Tests the pure function in isolation (the agent-factory call site
 * is exercised by the full agent-factory integration tests).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  routeToHITL,
  isHITLRoutingEnabled,
  buildHITLRoutingAuditEntry,
} from "@/lib/control-plane/hitl-routing";

describe("Move 21 — HITL routing env gate", () => {
  beforeEach(() => vi.unstubAllEnvs());

  it("default-OFF (existing fleet stays byte-identical)", () => {
    expect(isHITLRoutingEnabled()).toBe(false);
  });

  it("strict 'true' enables the gate", () => {
    vi.stubEnv("SOVEREIGN_HITL_ROUTING_ENABLED", "true");
    expect(isHITLRoutingEnabled()).toBe(true);
    vi.stubEnv("SOVEREIGN_HITL_ROUTING_ENABLED", "1");
    expect(isHITLRoutingEnabled()).toBe(false);
  });
});

describe("Move 21 — routeToHITL decision shapes", () => {
  beforeEach(() => vi.unstubAllEnvs());

  it("disabled gate → kind 'hitl_required' with reason 'gate_disabled' (conservative default)", () => {
    const d = routeToHITL({
      agentName: "test-agent",
      actionClass: "internal_read",
    });
    expect(d.kind).toBe("hitl_required");
    expect(d.reason).toBe("gate_disabled");
  });

  it("enabled gate + clean inputs → auto_proceed", () => {
    vi.stubEnv("SOVEREIGN_HITL_ROUTING_ENABLED", "true");
    const d = routeToHITL({
      agentName: "test-agent",
      actionClass: "internal_read",
    });
    expect(d.kind).toBe("auto_proceed");
  });

  it("enabled gate + always-HITL class → hitl_required", () => {
    vi.stubEnv("SOVEREIGN_HITL_ROUTING_ENABLED", "true");
    const d = routeToHITL({
      agentName: "test-agent",
      actionClass: "external_write",
      alwaysHITLClasses: ["external_write"],
    });
    expect(d.kind).toBe("hitl_required");
    expect(d.reason).toBe("always_hitl_action_class");
  });
});

describe("Move 21 — audit-entry shape (R155)", () => {
  beforeEach(() => vi.unstubAllEnvs());

  it("buildHITLRoutingAuditEntry uses agent.governance_consult action with phase=hitl-routing", () => {
    vi.stubEnv("SOVEREIGN_HITL_ROUTING_ENABLED", "true");
    const d = routeToHITL({
      agentName: "x",
      actionClass: "internal_read",
    });
    const a = buildHITLRoutingAuditEntry("x", d);
    expect(a.action).toBe("agent.governance_consult");
    expect(a.details.phase).toBe("hitl-routing");
  });
});
