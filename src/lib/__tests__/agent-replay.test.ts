import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/logger", () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));
import { startReplay, getReplay, getUserReplays, getReplayStats } from "@/lib/agent-replay";

describe("agent-replay.ts — Flight Recorder", () => {
  it("starts a replay with unique ID", () => {
    const replay = startReplay("leads", "user1");
    expect(replay.id).toMatch(/^rpl_/);
  });

  it("records steps", () => {
    const replay = startReplay("blog-gen", "user2");
    replay.addStep("input", { topic: "AI trends" });
    replay.addStep("model_selected", { model: "nemotron-ultra" });
    replay.addStep("execution", { output: "Generated blog..." });
    const trace = replay.complete();
    expect(trace.steps.length).toBe(3);
    expect(trace.status).toBe("complete");
    expect(trace.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it("retrieves replay by ID", () => {
    const replay = startReplay("seo", "user3");
    replay.addStep("start", {});
    replay.complete();
    const retrieved = getReplay(replay.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.agentName).toBe("seo");
  });

  it("lists user replays (newest first)", () => {
    startReplay("agent1", "user4").complete();
    startReplay("agent2", "user4").complete();
    startReplay("agent3", "user4").complete();
    const replays = getUserReplays("user4");
    expect(replays.length).toBeGreaterThanOrEqual(3);
    expect(replays[0].startedAt).toBeGreaterThanOrEqual(replays[1].startedAt);
  });

  it("records failure", () => {
    const replay = startReplay("failing-agent", "user5");
    replay.addStep("start", {});
    replay.fail("NIM returned 500");
    const trace = getReplay(replay.id);
    expect(trace?.status).toBe("failed");
    expect(trace?.steps.some(s => s.phase === "error")).toBe(true);
  });

  it("tracks duration per step", () => {
    const replay = startReplay("timed", "user6");
    replay.addStep("step1", {});
    replay.addStep("step2", {});
    const trace = replay.complete();
    expect(trace.steps[1].durationMs).toBeGreaterThanOrEqual(0);
  });

  it("computes replay stats", () => {
    startReplay("stat-agent", "user7").complete();
    startReplay("stat-agent", "user7").complete();
    const stats = getReplayStats("user7");
    expect(stats.totalReplays).toBeGreaterThanOrEqual(2);
    expect(stats.topAgents.length).toBeGreaterThan(0);
  });

  it("returns empty stats for unknown user", () => {
    const stats = getReplayStats("nonexistent-user");
    expect(stats.totalReplays).toBe(0);
  });
});
