/**
 * SLO TRACKING — Service-Level Objective definitions + sample recording.
 *
 * Five SLOs, one per critical user-facing flow:
 *
 *   1. health_availability   — /api/health/deep returns 200  (99.9% in 30d)
 *   2. agent_latency_p95     — agent routes p95 latency       (<8s)
 *   3. playbook_completion   — playbook runs complete in 5m   (98%)
 *   4. stripe_webhook_ok     — Stripe webhook success         (99.5%)
 *   5. voice_first_audio_p95 — voice turn-end → first audio   (<1.5s)
 *                               (only meaningful after Plan 3 ships)
 *
 * Storage: Upstash Redis sorted-set per SLO per day. Key format
 * `slo:<name>:<YYYY-MM-DD>` with score = sample timestamp (ms),
 * member = `<value>:<pass|fail>:<uuid>`. Retention: 35 days TTL so
 * we always have a 30d window plus buffer.
 *
 * Why Redis sorted sets: O(log N) insert, O(log N) percentile query,
 * free rolling-window expiry via TTL. Writing every agent-latency
 * sample to Postgres would be 10-50k rows/day — Redis handles 10x
 * that without breaking a sweat.
 *
 * A weekly cron reads each SLO's 7-day and 30-day rollups, checks
 * against targets, and posts breaches to Slack (if SLACK_WEBHOOK_URL).
 */

import { createHash } from "node:crypto";
import { createLogger } from "@/lib/logger";

const log = createLogger("slo");

/* ─── SLO definitions ───────────────────────────────────────── */

export type SLOName =
  | "health_availability"
  | "agent_latency_p95"
  | "playbook_completion"
  | "stripe_webhook_ok"
  | "voice_first_audio_p95";

export type SLOMode =
  // Availability: fraction of samples that "pass" must exceed target
  | "availability"
  // Latency: p95 of sample values must be <= target_ms
  | "latency_p95";

export interface SLODefinition {
  name: SLOName;
  description: string;
  mode: SLOMode;
  targetPct?: number;    // availability target (0..1)
  targetMs?: number;     // latency target
  windowDays: number;    // rolling window for the objective
}

export const SLOS: Record<SLOName, SLODefinition> = {
  health_availability: {
    name: "health_availability",
    description: "/api/health/deep returns 200",
    mode: "availability",
    targetPct: 0.999,
    windowDays: 30,
  },
  agent_latency_p95: {
    name: "agent_latency_p95",
    description: "Agent route p95 latency under 8 seconds",
    mode: "latency_p95",
    targetMs: 8_000,
    windowDays: 7,
  },
  playbook_completion: {
    name: "playbook_completion",
    description: "Playbook runs complete within 5 minutes",
    mode: "availability",
    targetPct: 0.98,
    windowDays: 7,
  },
  stripe_webhook_ok: {
    name: "stripe_webhook_ok",
    description: "Stripe webhook handler returns 200",
    mode: "availability",
    targetPct: 0.995,
    windowDays: 30,
  },
  voice_first_audio_p95: {
    name: "voice_first_audio_p95",
    description: "Voice turn-end to first audio chunk, p95 under 1.5s",
    mode: "latency_p95",
    targetMs: 1_500,
    windowDays: 7,
  },
};

/* ─── Sample recording ──────────────────────────────────────── */

/**
 * Record one sample. Fire-and-forget — a Redis outage must never
 * surface to the user. We log the failure and move on; an absent
 * sample just means a slightly noisier percentile.
 */
export async function recordSample(
  slo: SLOName,
  value: number,
  pass: boolean,
): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return; // fail-open when Upstash isn't configured

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const key = `slo:${slo}:${today}`;
  const ts = Date.now();
  // member uniqueness — timestamp + hash to avoid sorted-set dedup
  const uniq = createHash("sha256").update(`${ts}:${Math.random()}`).digest("hex").slice(0, 8);
  const member = `${value}:${pass ? "p" : "f"}:${uniq}`;

  try {
    await fetch(`${url}/zadd/${key}/${ts}/${encodeURIComponent(member)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(1500),
    });
    // Ensure 35-day TTL so old samples expire
    await fetch(`${url}/expire/${key}/${35 * 24 * 60 * 60}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(1500),
    });
  } catch (err) {
    log.warn("SLO sample write failed (not fatal)", {
      slo,
      error: (err as Error).message,
    });
  }
}

/* ─── Breach classification ─────────────────────────────────── */

export interface SampleSummary {
  count: number;
  passed: number;
  failed: number;
  values: number[]; // used for percentile calc
}

export interface BreachReport {
  slo: SLOName;
  breached: boolean;
  current: number;      // observed value (pass rate or p95 ms)
  target: number;       // the objective
  sampleCount: number;
  windowDays: number;
  message: string;
}

/**
 * Pure function: given a sample summary + the SLO def, decide whether
 * the SLO is breached. Tests pin the math; production uses this with
 * data pulled from Redis ZRANGEBYSCORE.
 */
export function classifyBreach(
  slo: SLODefinition,
  summary: SampleSummary,
): BreachReport {
  if (summary.count === 0) {
    return {
      slo: slo.name,
      breached: false,
      current: 0,
      target: slo.targetPct ?? slo.targetMs ?? 0,
      sampleCount: 0,
      windowDays: slo.windowDays,
      message: "No samples in window (insufficient signal)",
    };
  }

  if (slo.mode === "availability") {
    const passRate = summary.passed / summary.count;
    const target = slo.targetPct ?? 0;
    const breached = passRate < target;
    return {
      slo: slo.name,
      breached,
      current: passRate,
      target,
      sampleCount: summary.count,
      windowDays: slo.windowDays,
      message: breached
        ? `Availability ${(passRate * 100).toFixed(2)}% < target ${(target * 100).toFixed(2)}% over ${slo.windowDays}d`
        : `OK: ${(passRate * 100).toFixed(2)}% availability`,
    };
  }

  // mode === "latency_p95"
  const p95 = percentile(summary.values, 0.95);
  const target = slo.targetMs ?? 0;
  const breached = p95 > target;
  return {
    slo: slo.name,
    breached,
    current: p95,
    target,
    sampleCount: summary.count,
    windowDays: slo.windowDays,
    message: breached
      ? `p95 latency ${p95.toFixed(0)}ms > target ${target}ms over ${slo.windowDays}d`
      : `OK: p95 ${p95.toFixed(0)}ms`,
  };
}

/**
 * Exact percentile of a numeric array. Sorts a copy (doesn't mutate).
 * For 100k+ samples swap for a t-digest; for the 7-day window of a
 * typical SLO this is plenty fast.
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1));
  return sorted[idx];
}
