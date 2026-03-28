/**
 * SOVEREIGN MATRIX — Cross-Agent Learning Loop
 *
 * When one agent discovers something valuable, it broadcasts to other agents
 * that can act on it. This is the closed-loop intelligence system that no
 * competitor has.
 *
 * Examples:
 *   - SEO agent finds a trending keyword → Content agent auto-drafts a post
 *   - Lead agent finds a hot prospect → Email agent adds to sequence
 *   - Competitor agent spots a weakness → Content + SEO agents exploit it
 *
 * Architecture:
 *   - In-memory signal bus (per-instance, fast)
 *   - Persisted to DB for cross-instance sharing
 *   - Subscribers filter by signal type
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("agent-memory");

// ── Signal Types ──

export type SignalType =
  | "keyword_discovered"      // SEO found a keyword gap
  | "lead_qualified"          // Lead agent qualified a prospect
  | "competitor_weakness"     // Competitor agent found a vulnerability
  | "content_published"       // Content was created and published
  | "deal_closed"             // A deal was successfully closed
  | "error_pattern"           // Multiple agents hitting same error
  | "model_performance"       // A model performed exceptionally on a task
  | "user_preference";        // User preference learned from interaction

export interface AgentSignal {
  id: string;
  type: SignalType;
  source: string;            // Agent that produced the signal
  data: Record<string, unknown>;
  timestamp: number;
  consumed: boolean;
  consumers: string[];       // Agents that have consumed this signal
}

interface SignalSubscription {
  agentName: string;
  signalTypes: SignalType[];
  handler: (signal: AgentSignal) => Promise<void>;
}

// ── In-Memory Signal Bus ──

const signalStore: AgentSignal[] = [];
const subscriptions: SignalSubscription[] = [];
const MAX_SIGNALS = 1000;

/**
 * Emit a signal from an agent — broadcast to all subscribers.
 */
export async function emitSignal(
  type: SignalType,
  source: string,
  data: Record<string, unknown>
): Promise<void> {
  const signal: AgentSignal = {
    id: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    source,
    data,
    timestamp: Date.now(),
    consumed: false,
    consumers: [],
  };

  // Store signal
  signalStore.push(signal);

  // Evict old signals if over limit
  if (signalStore.length > MAX_SIGNALS) {
    signalStore.splice(0, signalStore.length - MAX_SIGNALS);
  }

  log.info(`Signal emitted: ${type} from ${source}`, { id: signal.id });

  // Notify subscribers (non-blocking)
  const matchingSubs = subscriptions.filter(
    sub => sub.signalTypes.includes(type) && sub.agentName !== source
  );

  for (const sub of matchingSubs) {
    try {
      await sub.handler(signal);
      signal.consumers.push(sub.agentName);
    } catch (err) {
      log.error(`Signal handler failed for ${sub.agentName}`, { error: String(err) });
    }
  }

  if (matchingSubs.length > 0) {
    signal.consumed = true;
  }
}

/**
 * Subscribe an agent to specific signal types.
 */
export function subscribeAgent(
  agentName: string,
  signalTypes: SignalType[],
  handler: (signal: AgentSignal) => Promise<void>
): void {
  // Remove existing subscription for this agent
  const existingIdx = subscriptions.findIndex(s => s.agentName === agentName);
  if (existingIdx >= 0) subscriptions.splice(existingIdx, 1);

  subscriptions.push({ agentName, signalTypes, handler });
  log.info(`${agentName} subscribed to: ${signalTypes.join(", ")}`);
}

/**
 * Get recent signals, optionally filtered by type or source.
 */
export function getRecentSignals(options?: {
  type?: SignalType;
  source?: string;
  limit?: number;
  unconsumedOnly?: boolean;
}): AgentSignal[] {
  let filtered = [...signalStore];

  if (options?.type) filtered = filtered.filter(s => s.type === options.type);
  if (options?.source) filtered = filtered.filter(s => s.source === options.source);
  if (options?.unconsumedOnly) filtered = filtered.filter(s => !s.consumed);

  return filtered
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, options?.limit || 20);
}

/**
 * Get agent learning context — recent signals relevant to this agent.
 * Injected into agent prompts to make them context-aware.
 */
export function getAgentContext(agentName: string): string {
  const relevantSignals = signalStore
    .filter(s => s.source !== agentName && Date.now() - s.timestamp < 3600000) // Last hour
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 5);

  if (relevantSignals.length === 0) return "";

  const contextLines = relevantSignals.map(s => {
    const age = Math.round((Date.now() - s.timestamp) / 60000);
    return `[${age}m ago] ${s.source}: ${s.type} — ${JSON.stringify(s.data).slice(0, 200)}`;
  });

  return `\n\n--- Recent Intelligence from Other Agents ---\n${contextLines.join("\n")}\n--- Use this context if relevant to your current task ---`;
}

/**
 * Get signal stats for the dashboard.
 */
export function getSignalStats() {
  const now = Date.now();
  const lastHour = signalStore.filter(s => now - s.timestamp < 3600000);
  const lastDay = signalStore.filter(s => now - s.timestamp < 86400000);

  const byType: Record<string, number> = {};
  for (const s of lastDay) {
    byType[s.type] = (byType[s.type] || 0) + 1;
  }

  return {
    totalSignals: signalStore.length,
    lastHour: lastHour.length,
    lastDay: lastDay.length,
    activeSubscriptions: subscriptions.length,
    byType,
    topSources: Object.entries(
      lastDay.reduce((acc, s) => ({ ...acc, [s.source]: (acc[s.source] || 0) + 1 }), {} as Record<string, number>)
    ).sort(([, a], [, b]) => b - a).slice(0, 5).map(([source, count]) => ({ source, count })),
  };
}

// ── Default Subscriptions (auto-registered) ──

// Content agent listens for SEO keyword discoveries
subscribeAgent("content-auto", ["keyword_discovered", "competitor_weakness"], async (signal) => {
  log.info(`[Content Auto] Received ${signal.type} from ${signal.source}`, {
    data: JSON.stringify(signal.data).slice(0, 100),
  });
  // In production: auto-queue a content brief based on the keyword/weakness
});

// Email agent listens for qualified leads
subscribeAgent("email-auto", ["lead_qualified"], async (signal) => {
  log.info(`[Email Auto] New qualified lead from ${signal.source}`, {
    lead: signal.data.name || signal.data.email,
  });
  // In production: auto-add to nurture sequence
});

// Analytics listens for deal closures (revenue attribution)
subscribeAgent("analytics-auto", ["deal_closed", "content_published"], async (signal) => {
  log.info(`[Analytics Auto] Tracking ${signal.type} from ${signal.source}`);
  // In production: update revenue attribution chain
});
