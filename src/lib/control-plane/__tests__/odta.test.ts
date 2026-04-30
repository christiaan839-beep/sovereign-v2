/**
 * R143 ODTA — runtime-placement test (4 predicates) tests.
 *
 * Coverage:
 *   - Feature-flag default-OFF / ON
 *   - Each of O / D / T / A failures individually
 *   - Multiple simultaneous failures collected
 *   - All-pass returns ok:true
 *   - Custom timeliness budget honored
 *   - Audit-entry shape on failure
 *   - Non-finite policyLatencyMs treated as timeliness failure
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isODTAGateEnabled,
  evaluateODTA,
  ODTA_PREDICATES,
  ODTA_TIMELINESS_BUDGET_MS,
  type ODTAInput,
} from "../odta";

const baseInput: ODTAInput = {
  agentName: "agent-x",
  actionDescriptor: "test-action",
  hasObservabilityProbe: true,
  hasPolicyDecision: true,
  policyLatencyMs: 10,
  hasAttestableAuditEntry: true,
};

describe("isODTAGateEnabled", () => {
  let original: string | undefined;
  beforeEach(() => {
    original = process.env.SOVEREIGN_ODTA_GATE_ENABLED;
  });
  afterEach(() => {
    if (original === undefined) delete process.env.SOVEREIGN_ODTA_GATE_ENABLED;
    else process.env.SOVEREIGN_ODTA_GATE_ENABLED = original;
  });

  it("default-OFF when env unset", () => {
    delete process.env.SOVEREIGN_ODTA_GATE_ENABLED;
    expect(isODTAGateEnabled()).toBe(false);
  });

  it("only 'true' enables", () => {
    process.env.SOVEREIGN_ODTA_GATE_ENABLED = "true";
    expect(isODTAGateEnabled()).toBe(true);
    process.env.SOVEREIGN_ODTA_GATE_ENABLED = "yes";
    expect(isODTAGateEnabled()).toBe(false);
  });
});

describe("ODTA_PREDICATES constant", () => {
  it("declares all 4 named predicates in canonical O/D/T/A order", () => {
    expect(ODTA_PREDICATES).toEqual([
      "observability",
      "decidability",
      "timeliness",
      "attestability",
    ]);
  });
});

describe("evaluateODTA — gate disabled", () => {
  it("returns ok:true and pass-through when flag off, even if all evidence absent", () => {
    delete process.env.SOVEREIGN_ODTA_GATE_ENABLED;
    const result = evaluateODTA({
      agentName: "x",
      actionDescriptor: "x",
      hasObservabilityProbe: false,
      hasPolicyDecision: false,
      policyLatencyMs: 9999,
      hasAttestableAuditEntry: false,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.passes.observability).toBe(true);
      expect(result.passes.decidability).toBe(true);
      expect(result.passes.timeliness).toBe(true);
      expect(result.passes.attestability).toBe(true);
    }
  });
});

describe("evaluateODTA — gate enabled, all-pass", () => {
  beforeEach(() => {
    process.env.SOVEREIGN_ODTA_GATE_ENABLED = "true";
  });
  afterEach(() => {
    delete process.env.SOVEREIGN_ODTA_GATE_ENABLED;
  });

  it("returns ok:true with all 4 predicates passing", () => {
    const result = evaluateODTA(baseInput);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.timelinessBudgetMs).toBe(ODTA_TIMELINESS_BUDGET_MS);
    }
  });
});

describe("evaluateODTA — individual failures", () => {
  beforeEach(() => {
    process.env.SOVEREIGN_ODTA_GATE_ENABLED = "true";
  });
  afterEach(() => {
    delete process.env.SOVEREIGN_ODTA_GATE_ENABLED;
  });

  it("observability failure", () => {
    const r = evaluateODTA({ ...baseInput, hasObservabilityProbe: false });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failed).toEqual(["observability"]);
      expect(r.details).toContain("observability probe");
    }
  });

  it("decidability failure", () => {
    const r = evaluateODTA({ ...baseInput, hasPolicyDecision: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failed).toEqual(["decidability"]);
  });

  it("timeliness failure when latency exceeds budget", () => {
    const r = evaluateODTA({ ...baseInput, policyLatencyMs: 100 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failed).toEqual(["timeliness"]);
      expect(r.details).toContain("100ms");
      expect(r.details).toContain("50ms");
    }
  });

  it("timeliness failure on non-finite latency (NaN/Infinity)", () => {
    const r = evaluateODTA({ ...baseInput, policyLatencyMs: NaN });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failed).toContain("timeliness");
  });

  it("attestability failure", () => {
    const r = evaluateODTA({ ...baseInput, hasAttestableAuditEntry: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failed).toEqual(["attestability"]);
  });
});

describe("evaluateODTA — multiple simultaneous failures", () => {
  beforeEach(() => {
    process.env.SOVEREIGN_ODTA_GATE_ENABLED = "true";
  });
  afterEach(() => {
    delete process.env.SOVEREIGN_ODTA_GATE_ENABLED;
  });

  it("collects all 4 failures when none pass", () => {
    const r = evaluateODTA({
      ...baseInput,
      hasObservabilityProbe: false,
      hasPolicyDecision: false,
      policyLatencyMs: 5000,
      hasAttestableAuditEntry: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failed).toEqual([
        "observability",
        "decidability",
        "timeliness",
        "attestability",
      ]);
    }
  });

  it("preserves canonical predicate order in failed[] regardless of which fail", () => {
    const r = evaluateODTA({
      ...baseInput,
      hasObservabilityProbe: false,
      hasAttestableAuditEntry: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      // observability comes before attestability per canonical order
      expect(r.failed).toEqual(["observability", "attestability"]);
    }
  });
});

describe("evaluateODTA — custom timeliness budget", () => {
  beforeEach(() => {
    process.env.SOVEREIGN_ODTA_GATE_ENABLED = "true";
  });
  afterEach(() => {
    delete process.env.SOVEREIGN_ODTA_GATE_ENABLED;
  });

  it("respects per-call timeliness override", () => {
    // 75ms latency would fail default 50ms budget but pass 100ms budget
    const failing = evaluateODTA({ ...baseInput, policyLatencyMs: 75 });
    expect(failing.ok).toBe(false);

    const passing = evaluateODTA({
      ...baseInput,
      policyLatencyMs: 75,
      timelinessBudgetMs: 100,
    });
    expect(passing.ok).toBe(true);
    if (passing.ok) expect(passing.timelinessBudgetMs).toBe(100);
  });
});

describe("evaluateODTA — audit-entry shape", () => {
  beforeEach(() => {
    process.env.SOVEREIGN_ODTA_GATE_ENABLED = "true";
  });
  afterEach(() => {
    delete process.env.SOVEREIGN_ODTA_GATE_ENABLED;
  });

  it("produces R26-compatible audit entry on failure", () => {
    const r = evaluateODTA({
      ...baseInput,
      agentName: "audit-test-agent",
      actionDescriptor: "external_write:db.users",
      hasObservabilityProbe: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.auditEntry.action).toBe("agent.governance_consult");
      expect(r.auditEntry.resource).toBe("agent:audit-test-agent");
      expect(r.auditEntry.details.phase).toBe("odta");
      expect(r.auditEntry.details.failed).toEqual(["observability"]);
      expect(r.auditEntry.details.actionDescriptor).toBe("external_write:db.users");
      expect(r.auditEntry.details.timelinessBudgetMs).toBe(50);
    }
  });
});
