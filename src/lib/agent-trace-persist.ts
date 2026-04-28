/**
 * Persist a TraceContext to the agent_traces table.
 *
 * Separated from agent-trace.ts so the runtime + ALS half is
 * Edge-safe (no DB import); persistence is Node-only.
 */

import {
  type TraceContext,
  traceTotalCostCents,
  traceFirstError,
} from "./agent-trace";
import { createLogger } from "./logger";

const log = createLogger("agent-trace-persist");

const DEFAULT_RETENTION_DAYS = 30;

/**
 * Persist a trace to `agent_traces`. Best-effort; never throws.
 *
 * Returns the new row's ID, or null on any failure (DB unavailable,
 * write error, missing schema). The audit log is the durable
 * backstop — losing a trace is not a critical event.
 */
export async function persistTrace(input: {
  trace: TraceContext;
  userId: string;
  auditId?: string;
  retentionDays?: number;
}): Promise<{ traceId: string } | null> {
  if (!process.env.DATABASE_URL) return null;
  if (input.trace.spans.length === 0) return null; // empty trace = nothing to persist

  try {
    const { db } = await import("@/db");
    const { agentTraces } = await import("@/db/schema");

    const totalCostCents = traceTotalCostCents(input.trace);
    const firstError = traceFirstError(input.trace);
    const totalDurationMs = Math.max(
      0,
      Math.max(...input.trace.spans.map((s) => s.startMs + s.durationMs)),
    );
    const retainUntil = new Date(
      Date.now() + (input.retentionDays ?? DEFAULT_RETENTION_DAYS) * 24 * 60 * 60 * 1000,
    );

    const result = await db
      .insert(agentTraces)
      .values({
        auditId: input.auditId,
        userId: input.userId,
        agentName: input.trace.rootAgentName,
        totalDurationMs,
        totalCostCents,
        spans: input.trace.spans,
        spanCount: input.trace.spans.length,
        firstError,
        retainUntil,
      })
      .returning({ id: agentTraces.id });

    return result[0] ? { traceId: String(result[0].id) } : null;
  } catch (err) {
    log.warn("persistTrace failed", { error: String(err) });
    return null;
  }
}
