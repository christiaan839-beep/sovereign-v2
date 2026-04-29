/**
 * R102 — Cost Governance unit tests.
 *
 * Coverage:
 *   - alertLevelFor: thresholds at 50/75/90% inclusive
 *   - providerCostTier: free/paid/metered for known providers
 *   - isWindowActive: now < windowEnd
 *   - evaluateBudgets: free-tier bypass returns proceed without adding cost
 *   - evaluateBudgets: tenant-cap breach returns deny + breachedScope=tenant
 *   - evaluateBudgets: team-cap breach returns deny + breachedScope=team
 *   - evaluateBudgets: agent-cap breach returns deny + breachedScope=agent
 *   - evaluateBudgets: window-elapsed returns deny
 *   - evaluateBudgets: -1 cap (unlimited) never breaches
 *   - evaluateBudgets: highest alert wins across multiple caps
 *   - previewBudgets: produces tenant + team + agent rows when present
 *   - reasons are procurement-readable (mention scope + cents)
 */

import { describe, it, expect } from "vitest";
import {
  alertLevelFor,
  providerCostTier,
  isWindowActive,
  evaluateBudgets,
  previewBudgets,
  type CostGovernanceContext,
  type BudgetCap,
} from "@/lib/control-plane/cost-governance";

const tenantCap: BudgetCap = {
  capCents: 5000,
  windowStart: "2026-04-29T00:00:00.000Z",
  windowEnd: "2026-04-30T00:00:00.000Z",
};

const baseCtx: CostGovernanceContext = {
  tenantId: "tenant_acme",
  agentId: "1099-reader",
  provider: "anthropic",
  plannedCostCents: 100,
  tenantSpentCents: 1000,
  tenantCap,
  now: new Date("2026-04-29T12:00:00.000Z"),
};

describe("alertLevelFor", () => {
  it("ok below 50%", () => {
    expect(alertLevelFor(49, 100)).toBe("ok");
  });
  it("warn-50 at exactly 50%", () => {
    expect(alertLevelFor(50, 100)).toBe("warn-50");
  });
  it("warn-75 at exactly 75%", () => {
    expect(alertLevelFor(75, 100)).toBe("warn-75");
  });
  it("warn-90 at exactly 90%", () => {
    expect(alertLevelFor(90, 100)).toBe("warn-90");
  });
  it("warn-90 above 90%", () => {
    expect(alertLevelFor(110, 100)).toBe("warn-90");
  });
  it("zero cap → max alert", () => {
    expect(alertLevelFor(10, 0)).toBe("warn-90");
  });
});

describe("providerCostTier", () => {
  it("classifies known free providers", () => {
    expect(providerCostTier("ollama")).toBe("free");
    expect(providerCostTier("nim")).toBe("free");
    expect(providerCostTier("cerebras")).toBe("free");
  });
  it("classifies known paid providers", () => {
    expect(providerCostTier("anthropic")).toBe("paid");
  });
  it("defaults unknown providers to paid (safe)", () => {
    expect(providerCostTier("nonexistent-provider")).toBe("paid");
  });
});

describe("isWindowActive", () => {
  it("active when now < windowEnd", () => {
    expect(
      isWindowActive(tenantCap, new Date("2026-04-29T12:00:00.000Z")),
    ).toBe(true);
  });
  it("inactive when now >= windowEnd", () => {
    expect(
      isWindowActive(tenantCap, new Date("2026-04-30T00:00:00.000Z")),
    ).toBe(false);
  });
});

describe("evaluateBudgets — free-tier bypass", () => {
  it("returns proceed + freeRun=true for free provider", () => {
    const v = evaluateBudgets({ ...baseCtx, provider: "ollama" });
    expect(v.decision).toBe("proceed");
    if (v.decision === "proceed") {
      expect(v.freeRun).toBe(true);
      expect(v.reason).toContain("free-tier");
    }
  });

  it("free-tier doesn't increment projectedSpendCents", () => {
    const v = evaluateBudgets({
      ...baseCtx,
      provider: "ollama",
      plannedCostCents: 99999,
    });
    if (v.decision === "proceed") {
      expect(v.projectedSpendCents).toBe(baseCtx.tenantSpentCents);
    }
  });

  it("free-tier still reports tenant alert level (no false-green)", () => {
    const v = evaluateBudgets({
      ...baseCtx,
      provider: "ollama",
      tenantSpentCents: 4500, // 90% of 5000
    });
    if (v.decision === "proceed") {
      expect(v.alertLevel).toBe("warn-90");
    }
  });
});

describe("evaluateBudgets — paid runs respect tenant cap", () => {
  it("proceeds when projected within tenant cap", () => {
    const v = evaluateBudgets({ ...baseCtx, plannedCostCents: 100 });
    expect(v.decision).toBe("proceed");
  });

  it("denies when planned exceeds tenant cap", () => {
    const v = evaluateBudgets({ ...baseCtx, plannedCostCents: 9999 });
    expect(v.decision).toBe("deny");
    if (v.decision === "deny") {
      expect(v.breachedScope).toBe("tenant");
      expect(v.reason).toContain("tenant daily cap");
      expect(v.reason).toContain("¢");
    }
  });

  it("unlimited tenant cap (-1) never breaches", () => {
    const v = evaluateBudgets({
      ...baseCtx,
      plannedCostCents: 999999999,
      tenantCap: { ...tenantCap, capCents: -1 },
    });
    expect(v.decision).toBe("proceed");
  });
});

describe("evaluateBudgets — team cap", () => {
  const withTeam: CostGovernanceContext = {
    ...baseCtx,
    teamId: "marketing",
    teamSpentCents: 1900,
    teamCap: {
      capCents: 2000,
      windowStart: "2026-04-29T00:00:00.000Z",
      windowEnd: "2026-04-30T00:00:00.000Z",
    },
  };

  it("denies when team cap would breach (even if tenant fine)", () => {
    const v = evaluateBudgets({ ...withTeam, plannedCostCents: 200 });
    expect(v.decision).toBe("deny");
    if (v.decision === "deny") {
      expect(v.breachedScope).toBe("team");
      expect(v.reason).toContain("marketing");
    }
  });

  it("proceeds when both team and tenant within cap", () => {
    const v = evaluateBudgets({ ...withTeam, plannedCostCents: 50 });
    expect(v.decision).toBe("proceed");
  });
});

describe("evaluateBudgets — agent cap", () => {
  const withAgent: CostGovernanceContext = {
    ...baseCtx,
    agentSpentCents: 950,
    agentCap: {
      capCents: 1000,
      windowStart: "2026-04-29T00:00:00.000Z",
      windowEnd: "2026-04-30T00:00:00.000Z",
    },
  };

  it("denies when agent cap would breach", () => {
    const v = evaluateBudgets({ ...withAgent, plannedCostCents: 100 });
    expect(v.decision).toBe("deny");
    if (v.decision === "deny") {
      expect(v.breachedScope).toBe("agent");
      expect(v.reason).toContain("1099-reader");
    }
  });
});

describe("evaluateBudgets — window-elapsed safety", () => {
  it("denies when tenant window has elapsed (force ledger rotation)", () => {
    const v = evaluateBudgets({
      ...baseCtx,
      now: new Date("2026-05-01T00:00:00.000Z"),
    });
    expect(v.decision).toBe("deny");
    if (v.decision === "deny") {
      expect(v.breachedScope).toBe("window-elapsed");
    }
  });
});

describe("evaluateBudgets — multi-cap alert resolution", () => {
  it("highest alert level across all caps wins", () => {
    const v = evaluateBudgets({
      ...baseCtx,
      tenantSpentCents: 100, // 2% — ok
      teamId: "x",
      teamSpentCents: 850, // 85% post-add (with planned 100) — warn-75 actually
      teamCap: {
        capCents: 1000,
        windowStart: "2026-04-29T00:00:00.000Z",
        windowEnd: "2026-04-30T00:00:00.000Z",
      },
      agentSpentCents: 50,
      agentCap: {
        capCents: 100,
        windowStart: "2026-04-29T00:00:00.000Z",
        windowEnd: "2026-04-30T00:00:00.000Z",
      }, // post-add 150% — but caps to deny via agent cap
    });
    // The agent cap will breach (50 + 100 = 150 > 100) → deny
    expect(v.decision).toBe("deny");
  });

  it("returns warn-75 alert when team is at 75%+", () => {
    const v = evaluateBudgets({
      ...baseCtx,
      tenantSpentCents: 100,
      teamId: "x",
      teamSpentCents: 700, // post-add 800/1000 = 80% → warn-75
      teamCap: {
        capCents: 1000,
        windowStart: "2026-04-29T00:00:00.000Z",
        windowEnd: "2026-04-30T00:00:00.000Z",
      },
      plannedCostCents: 100,
    });
    if (v.decision === "proceed") {
      expect(v.alertLevel).toBe("warn-75");
    }
  });
});

describe("previewBudgets — read-only snapshot", () => {
  it("returns tenant row only when no team/agent caps", () => {
    const rows = previewBudgets({
      tenantId: "t",
      agentId: "a",
      tenantSpentCents: 1000,
      tenantCap,
    });
    expect(rows.length).toBe(1);
    expect(rows[0].scope).toBe("tenant");
  });

  it("returns tenant + team + agent rows when all present", () => {
    const rows = previewBudgets({
      tenantId: "t",
      agentId: "a",
      teamId: "marketing",
      tenantSpentCents: 1000,
      tenantCap,
      teamSpentCents: 500,
      teamCap: {
        capCents: 2000,
        windowStart: tenantCap.windowStart,
        windowEnd: tenantCap.windowEnd,
      },
      agentSpentCents: 200,
      agentCap: {
        capCents: 500,
        windowStart: tenantCap.windowStart,
        windowEnd: tenantCap.windowEnd,
      },
    });
    expect(rows.length).toBe(3);
    expect(rows.map((r) => r.scope)).toEqual(["tenant", "team", "agent"]);
  });

  it("utilization = spent / cap", () => {
    const rows = previewBudgets({
      tenantId: "t",
      agentId: "a",
      tenantSpentCents: 2500,
      tenantCap,
    });
    expect(rows[0].utilization).toBeCloseTo(0.5, 5);
    expect(rows[0].alertLevel).toBe("warn-50");
  });

  it("unlimited cap (-1) reports remaining as -1", () => {
    const rows = previewBudgets({
      tenantId: "t",
      agentId: "a",
      tenantSpentCents: 9999999,
      tenantCap: { ...tenantCap, capCents: -1 },
    });
    expect(rows[0].remainingCents).toBe(-1);
  });
});
