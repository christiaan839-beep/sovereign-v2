/**
 * SOVEREIGN MATRIX — In-process event bus (Wave 21).
 *
 * Lightweight pub/sub layer that powers the /api/events SSE stream.
 * Every elite platform pushes state to its dashboard instead of
 * forcing it to poll. We do the same.
 *
 * Scope deliberately narrow:
 *   - In-process only. On Vercel each lambda is its own bus, so events
 *     are scoped to whichever instance handled the publish. The SSE
 *     stream attaches to one instance and stays sticky; that's fine
 *     for a single-tenant dashboard but does NOT broadcast across the
 *     fleet. For cross-instance fanout we'd swap this for Upstash
 *     Pub/Sub or a Postgres LISTEN/NOTIFY — flagged for Wave 26.
 *   - No persistence. Events are emitted, delivered to live
 *     subscribers, dropped on the floor for late joiners. The audit
 *     log is the durable record.
 *   - Tenant-scoped subscriptions: every subscriber declares its
 *     tenantId. The bus filters before delivery so a tenant never
 *     sees another tenant's events.
 *
 * Pairs with /api/events (SSE endpoint), src/hooks/useSovereignEvents
 * (React subscriber), and the publishers in lib/agent-runs / lib/
 * agent-tokens / lib/anomalous-login.
 */

export type SovereignEventType =
  /** Wave-7: a new agent_runs row was sealed and signed. */
  | "agent.run.sealed"
  /** Wave-16: a JIT token was issued. */
  | "agent.token.issued"
  /** Wave-16: a JIT token was revoked. */
  | "agent.token.revoked"
  /** Cook-181 wired into Wave-19 webhook: anomalous-login fired. */
  | "anomaly.login.flagged"
  /** Budget enforcement (planned Wave 22): tenant approached spend cap. */
  | "budget.threshold.crossed"
  /** Guardian verdict (Wave 17): block-level verdict from any Guardian. */
  | "guardian.verdict.block"
  /** ACP envelope (Wave 18) issued. */
  | "commerce.envelope.issued";

export interface SovereignEvent<T = unknown> {
  /** Stable id — useful for SSE Last-Event-ID resumption. */
  id: string;
  /** Topic discriminator. */
  type: SovereignEventType;
  /** Tenant scope. "*" = platform-wide (admin-only on the subscriber side). */
  tenantId: string | "*";
  /** ISO-8601 emission timestamp. */
  emittedAt: string;
  /** Structured payload. Shape depends on `type` — keep small. */
  data: T;
}

type Listener = (e: SovereignEvent) => void;

interface Subscription {
  id: number;
  tenantId: string | "*";
  /** When "*", subscriber receives every tenant's events (admin only). */
  listener: Listener;
}

// ── Bus state ─────────────────────────────────────────────────────────

const subscribers = new Set<Subscription>();
let nextSubId = 1;
let nextEventId = 1;

/**
 * Publish an event to every matching subscriber. Synchronous fan-out
 * — listeners that throw are isolated (we don't let one bad subscriber
 * break the chain).
 */
export function publish<T>(
  type: SovereignEventType,
  tenantId: string | "*",
  data: T,
): SovereignEvent<T> {
  const evt: SovereignEvent<T> = {
    id: `evt_${nextEventId++}`,
    type,
    tenantId,
    emittedAt: new Date().toISOString(),
    data,
  };
  for (const sub of subscribers) {
    // Delivery rules:
    //   1. tenant "*" subscribers receive everything (admin streams).
    //   2. tenant-scoped subscribers receive their own events AND
    //      platform-wide ("*") events.
    if (
      sub.tenantId === "*" ||
      sub.tenantId === evt.tenantId ||
      evt.tenantId === "*"
    ) {
      try {
        sub.listener(evt);
      } catch {
        // Isolate — one bad subscriber doesn't break the chain.
      }
    }
  }
  return evt;
}

/**
 * Subscribe to events. Returns an unsubscribe function the caller MUST
 * invoke on stream teardown — otherwise the bus leaks closures.
 */
export function subscribe(
  tenantId: string | "*",
  listener: Listener,
): () => void {
  const sub: Subscription = { id: nextSubId++, tenantId, listener };
  subscribers.add(sub);
  return () => {
    subscribers.delete(sub);
  };
}

/** Test/diagnostic: current subscriber count. */
export function subscriberCount(): number {
  return subscribers.size;
}

/** Test-only: clear all subscribers (used by hermetic test reset). */
export function _resetBusForTests(): void {
  subscribers.clear();
  nextSubId = 1;
  nextEventId = 1;
}

// ── Typed publisher helpers — one per event type ──────────────────────

export interface AgentRunSealedPayload {
  receiptId: string;
  agentName: string;
  modelUsed: string;
  durationMs: number;
  trustDecision: string;
}

export interface AgentTokenPayload {
  tokenId: string;
  agentSlug: string;
  scopes: string[];
}

export interface AnomalyLoginPayload {
  userId: string;
  riskBand: string;
  recommendation: string;
}

export interface BudgetThresholdPayload {
  usedCents: number;
  capCents: number;
  pctUsed: number;
}

export interface GuardianBlockPayload {
  verdictId: string;
  agentSlug: string;
  ruleId: string;
  reason?: string;
}

export interface CommerceEnvelopePayload {
  envelopeId: string;
  merchantId: string;
  amountCents: number;
  currency: string;
}

export const publishAgentRunSealed = (
  tenantId: string | "*",
  data: AgentRunSealedPayload,
) => publish("agent.run.sealed", tenantId, data);

export const publishTokenIssued = (
  tenantId: string | "*",
  data: AgentTokenPayload,
) => publish("agent.token.issued", tenantId, data);

export const publishTokenRevoked = (
  tenantId: string | "*",
  data: AgentTokenPayload,
) => publish("agent.token.revoked", tenantId, data);

export const publishAnomalyFlagged = (
  tenantId: string | "*",
  data: AnomalyLoginPayload,
) => publish("anomaly.login.flagged", tenantId, data);

export const publishBudgetThreshold = (
  tenantId: string | "*",
  data: BudgetThresholdPayload,
) => publish("budget.threshold.crossed", tenantId, data);

export const publishGuardianBlock = (
  tenantId: string | "*",
  data: GuardianBlockPayload,
) => publish("guardian.verdict.block", tenantId, data);

export const publishCommerceEnvelope = (
  tenantId: string | "*",
  data: CommerceEnvelopePayload,
) => publish("commerce.envelope.issued", tenantId, data);
