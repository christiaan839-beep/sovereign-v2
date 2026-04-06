/**
 * SOVEREIGN MATRIX — Agent Replay System
 *
 * Records every step of an agent's execution as a "replay trace."
 * Users can rewatch any execution step-by-step, seeing:
 * - What input the agent received
 * - Which model was selected and why
 * - What the safety checks found
 * - The raw output before quality scoring
 * - How the quality scorer graded it
 * - What the critic changed
 * - The final output
 *
 * This is the "flight recorder" for AI agents. No other platform has this.
 *
 * Usage:
 *   const replay = startReplay("leads", userId);
 *   replay.addStep("input_received", { niche: "SaaS", location: "Austin" });
 *   replay.addStep("model_selected", { model: "nemotron-ultra", reason: "best for research" });
 *   replay.addStep("safety_check", { jailbreak: false, pii: false });
 *   replay.addStep("execution", { output: "Found 23 companies..." });
 *   replay.addStep("quality_score", { score: 0.87, passed: true });
 *   replay.complete();
 *
 *   // Later: retrieve and replay
 *   const trace = getReplay(replay.id);
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("agent-replay");

// ── Types ──

export interface ReplayStep {
  phase: string;
  data: Record<string, unknown>;
  timestamp: number;
  durationMs?: number;
}

export interface ReplayTrace {
  id: string;
  userId: string;
  agentName: string;
  status: "recording" | "complete" | "failed";
  steps: ReplayStep[];
  startedAt: number;
  completedAt?: number;
  totalDurationMs?: number;
  metadata?: Record<string, unknown>;
}

// ── Storage ──

const replayStore = new Map<string, ReplayTrace>();
const userIndex = new Map<string, string[]>(); // userId → replayIds
const MAX_REPLAYS_PER_USER = 50;

// ── Replay Builder ──

export interface ReplayBuilder {
  id: string;
  addStep: (phase: string, data: Record<string, unknown>) => void;
  complete: (metadata?: Record<string, unknown>) => ReplayTrace;
  fail: (error: string) => void;
}

/**
 * Start recording a new replay trace.
 */
export function startReplay(agentName: string, userId: string): ReplayBuilder {
  const id = `rpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const startedAt = Date.now();

  const trace: ReplayTrace = {
    id,
    userId,
    agentName,
    status: "recording",
    steps: [],
    startedAt,
  };

  replayStore.set(id, trace);

  // Index by user
  const userReplays = userIndex.get(userId) || [];
  userReplays.push(id);
  // Prune oldest if over limit
  if (userReplays.length > MAX_REPLAYS_PER_USER) {
    const removed = userReplays.shift()!;
    replayStore.delete(removed);
  }
  userIndex.set(userId, userReplays);

  let lastStepTime = startedAt;

  return {
    id,
    addStep(phase: string, data: Record<string, unknown>) {
      const now = Date.now();
      trace.steps.push({
        phase,
        data,
        timestamp: now,
        durationMs: now - lastStepTime,
      });
      lastStepTime = now;
    },
    complete(metadata?: Record<string, unknown>) {
      trace.status = "complete";
      trace.completedAt = Date.now();
      trace.totalDurationMs = Date.now() - startedAt;
      trace.metadata = metadata;
      log.info("Replay recorded", { id, agent: agentName, steps: trace.steps.length, duration: trace.totalDurationMs });
      return trace;
    },
    fail(error: string) {
      trace.status = "failed";
      trace.completedAt = Date.now();
      trace.totalDurationMs = Date.now() - startedAt;
      trace.steps.push({ phase: "error", data: { error }, timestamp: Date.now() });
    },
  };
}

/**
 * Get a replay trace by ID.
 */
export function getReplay(id: string): ReplayTrace | undefined {
  return replayStore.get(id);
}

/**
 * Get all replays for a user (newest first).
 */
export function getUserReplays(userId: string, limit: number = 20): ReplayTrace[] {
  const ids = userIndex.get(userId) || [];
  return ids
    .map(id => replayStore.get(id))
    .filter((r): r is ReplayTrace => r !== undefined)
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, limit);
}

/**
 * Get replay statistics for a user.
 */
export function getReplayStats(userId: string): {
  totalReplays: number;
  avgDurationMs: number;
  avgSteps: number;
  topAgents: Array<{ agent: string; count: number }>;
} {
  const replays = getUserReplays(userId, 100);
  if (replays.length === 0) return { totalReplays: 0, avgDurationMs: 0, avgSteps: 0, topAgents: [] };

  const totalDuration = replays.reduce((sum, r) => sum + (r.totalDurationMs || 0), 0);
  const totalSteps = replays.reduce((sum, r) => sum + r.steps.length, 0);

  const agentCounts = new Map<string, number>();
  for (const r of replays) {
    agentCounts.set(r.agentName, (agentCounts.get(r.agentName) || 0) + 1);
  }

  return {
    totalReplays: replays.length,
    avgDurationMs: Math.round(totalDuration / replays.length),
    avgSteps: Math.round(totalSteps / replays.length),
    topAgents: [...agentCounts.entries()]
      .map(([agent, count]) => ({ agent, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  };
}
