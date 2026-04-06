/**
 * SOVEREIGN MATRIX — Lightweight Analytics Tracker
 *
 * In-memory analytics with no external dependencies.
 * Tracks page views, agent executions, and user actions.
 * Capped at 500 total events.
 */

// ─── Types ───

export interface PageView {
  page: string;
  timestamp: string;
  referrer: string;
}

export interface AgentExecution {
  agentName: string;
  durationMs: number;
  success: boolean;
  timestamp: string;
}

export interface UserAction {
  action: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface AnalyticsSummary {
  pageViews: PageView[];
  agentExecutions: AgentExecution[];
  userActions: UserAction[];
  topPages: Array<{ page: string; count: number }>;
  topAgents: Array<{ agent: string; count: number; avgDurationMs: number; successRate: number }>;
}

// ─── Storage ───

const MAX_EVENTS = 500;

const pageViews: PageView[] = [];
const agentExecutions: AgentExecution[] = [];
const userActions: UserAction[] = [];

/** Enforce global cap across all event arrays. */
function enforceLimit(): void {
  const total = pageViews.length + agentExecutions.length + userActions.length;
  if (total <= MAX_EVENTS) return;

  // Trim oldest from the largest bucket first
  const buckets = [
    { arr: pageViews, len: pageViews.length },
    { arr: agentExecutions, len: agentExecutions.length },
    { arr: userActions, len: userActions.length },
  ].sort((a, b) => b.len - a.len);

  let overflow = total - MAX_EVENTS;
  for (const bucket of buckets) {
    if (overflow <= 0) break;
    const remove = Math.min(overflow, Math.ceil(bucket.len / 3));
    bucket.arr.splice(0, remove);
    overflow -= remove;
  }
}

// ─── Track Functions ───

export function trackPageView(page: string, referrer = ""): void {
  pageViews.push({
    page,
    timestamp: new Date().toISOString(),
    referrer,
  });
  enforceLimit();
}

export function trackAgentExecution(
  agentName: string,
  durationMs: number,
  success: boolean
): void {
  agentExecutions.push({
    agentName,
    durationMs,
    success,
    timestamp: new Date().toISOString(),
  });
  enforceLimit();

  // Also feed the model tracker (model is captured separately by AI router)
  import("@/lib/model-tracker")
    .then(({ recordModelExecution }) => {
      recordModelExecution(`agent:${agentName}`, { latencyMs: durationMs, success });
    })
    .catch(() => { /* model-tracker not available */ });
}

export function trackUserAction(
  action: string,
  metadata?: Record<string, unknown>
): void {
  userActions.push({
    action,
    metadata,
    timestamp: new Date().toISOString(),
  });
  enforceLimit();
}

// ─── Query Functions ───

export function getAnalytics(): AnalyticsSummary {
  // Top pages by visit count
  const pageCounts = new Map<string, number>();
  for (const pv of pageViews) {
    pageCounts.set(pv.page, (pageCounts.get(pv.page) ?? 0) + 1);
  }
  const topPages = Array.from(pageCounts.entries())
    .map(([page, count]) => ({ page, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Top agents by execution count, with avg duration and success rate
  const agentStats = new Map<
    string,
    { count: number; totalMs: number; successes: number }
  >();
  for (const ae of agentExecutions) {
    const stat = agentStats.get(ae.agentName) ?? {
      count: 0,
      totalMs: 0,
      successes: 0,
    };
    stat.count++;
    stat.totalMs += ae.durationMs;
    if (ae.success) stat.successes++;
    agentStats.set(ae.agentName, stat);
  }
  const topAgents = Array.from(agentStats.entries())
    .map(([agent, s]) => ({
      agent,
      count: s.count,
      avgDurationMs: Math.round(s.totalMs / s.count),
      successRate: Math.round((s.successes / s.count) * 100) / 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    pageViews: [...pageViews],
    agentExecutions: [...agentExecutions],
    userActions: [...userActions],
    topPages,
    topAgents,
  };
}
