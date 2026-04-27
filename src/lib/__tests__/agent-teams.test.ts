/**
 * Tests for src/lib/agent-teams.ts — Multi-agent debate engine.
 *
 * Each pre-built team (war-room / content-council / deal-room) has a fixed
 * member roster, debate-round count, and lead synthesis prompt. Breaking
 * the orchestration sequence here means every /api/teams/run call returns
 * partial output or hangs — silent failure on a high-value flow.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

const mockAi = vi.fn();
vi.mock("@/lib/ai", () => ({
  ai: (...a: unknown[]) => mockAi(...a),
}));

beforeEach(() => {
  vi.clearAllMocks();
  // Default: every ai() call returns a tagged stub. The synthesis call uses
  // maxTokens: 3000 (analysis=2000, critique=800), so we can identify it
  // unambiguously regardless of which team's lead prompt phrasing varies.
  mockAi.mockImplementation(
    async (
      _prompt: string,
      opts: { system?: string; maxTokens?: number } = {},
    ) => {
      if (opts.maxTokens === 3000) {
        return "FINAL: 85% confidence in the plan.";
      }
      return "agent-output";
    },
  );
});

describe("getAvailableTeams", () => {
  it("returns the 3 pre-built teams with full structure", async () => {
    const { getAvailableTeams } = await import("@/lib/agent-teams");
    const teams = getAvailableTeams();

    const keys = teams.map((t) => t.key);
    expect(keys).toEqual(
      expect.arrayContaining(["war-room", "content-council", "deal-room"]),
    );

    for (const t of teams) {
      expect(t.name).toBeTruthy();
      expect(t.lead).toBeTruthy();
      expect(Array.isArray(t.members)).toBe(true);
      expect(t.members.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("war-room includes a Devil's Advocate (the cost-leak protection from P3)", async () => {
    const { getAvailableTeams } = await import("@/lib/agent-teams");
    const warRoom = getAvailableTeams().find((t) => t.key === "war-room");
    expect(warRoom).toBeDefined();
    expect(warRoom!.members).toContain("Devil's Advocate");
  });
});

describe("runAgentTeam — pipeline shape", () => {
  it("returns synthesis + perspectives + debate + confidence + duration", async () => {
    const { runAgentTeam } = await import("@/lib/agent-teams");
    const result = await runAgentTeam({
      objective: "Find HubSpot's pricing weaknesses",
      team: "war-room",
    });

    expect(result.team).toBe("War Room");
    expect(result.synthesis).toBe("FINAL: 85% confidence in the plan.");
    expect(Array.isArray(result.perspectives)).toBe(true);
    expect(result.perspectives.length).toBe(4); // war-room has 4 members
    expect(Array.isArray(result.debate)).toBe(true);
    expect(typeof result.duration).toBe("number");
    expect(typeof result.confidence).toBe("number");
  });

  it("extracts confidence from synthesis text (e.g., '85% confidence' → 0.85)", async () => {
    const { runAgentTeam } = await import("@/lib/agent-teams");
    const result = await runAgentTeam({
      objective: "x",
      team: "content-council",
    });

    expect(result.confidence).toBeCloseTo(0.85, 2);
  });

  it("falls back to 0.75 confidence when synthesis lacks a percent", async () => {
    mockAi.mockImplementation(
      async (_p: string, opts: { maxTokens?: number } = {}) => {
        if (opts.maxTokens === 3000) return "no number here";
        return "agent-output";
      },
    );
    const { runAgentTeam } = await import("@/lib/agent-teams");
    const result = await runAgentTeam({
      objective: "x",
      team: "deal-room",
    });

    expect(result.confidence).toBe(0.75);
  });
});

describe("runAgentTeam — cost-controlled model routing (P3 regression test)", () => {
  it("uses Cerebras for parallel analyses (high fanout, cheap)", async () => {
    const { runAgentTeam } = await import("@/lib/agent-teams");
    await runAgentTeam({ objective: "x", team: "deal-room" });

    // First N calls (one per member) are the parallel analyses.
    // We just check that Cerebras was used at least once for those calls.
    const modelArgs = mockAi.mock.calls.map((c) => c[1]?.model);
    expect(modelArgs).toContain("cerebras");
  });

  it("uses NIM for debate rounds (medium fanout, free)", async () => {
    const { runAgentTeam } = await import("@/lib/agent-teams");
    await runAgentTeam({ objective: "x", team: "deal-room" });

    const modelArgs = mockAi.mock.calls.map((c) => c[1]?.model);
    expect(modelArgs).toContain("nim");
  });

  it("uses Gemini for the FINAL synthesis (one call, premium quality)", async () => {
    const { runAgentTeam } = await import("@/lib/agent-teams");
    await runAgentTeam({ objective: "x", team: "deal-room" });

    // The synthesis is the LAST ai() call.
    const lastCall = mockAi.mock.calls[mockAi.mock.calls.length - 1];
    expect(lastCall[1]?.model).toBe("gemini");
  });

  it("does NOT use Claude anywhere (cost-leak prevention)", async () => {
    const { runAgentTeam } = await import("@/lib/agent-teams");
    await runAgentTeam({ objective: "x", team: "war-room" });

    const modelArgs = mockAi.mock.calls.map((c) => c[1]?.model);
    expect(modelArgs).not.toContain("claude");
  });
});

describe("runAgentTeam — error handling", () => {
  it("throws a clear error when given an unknown team key", async () => {
    const { runAgentTeam } = await import("@/lib/agent-teams");
    await expect(
      runAgentTeam({
        objective: "x",
        team: "made-up-team" as Parameters<typeof runAgentTeam>[0]["team"],
      }),
    ).rejects.toThrow(/Unknown team/);
  });
});
