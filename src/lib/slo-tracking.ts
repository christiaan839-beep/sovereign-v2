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

import { createLogger } from "@/lib/logger";

// Note: this module is intentionally edge-safe. It used to import
// node:crypto for an 8-char unique suffix on sorted-set members, but
// that pulled the whole logger graph into Edge bundles via the OG
// image route + smart-router → Edge App Route. The uniqueness suffix
// doesn't need crypto-grade randomness — it just has to avoid sorted-
// set dedup collisions. `Math.random()` is plenty.

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
  // member uniqueness — timestamp + random suffix avoids sorted-set
  // dedup. `Math.random()` is fine: the suffix isn't a secret, just a
  // tie-breaker for samples recorded in the same millisecond.
  const uniq = Math.random().toString(36).slice(2, 10).padEnd(8, "0");
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

/* ─── Redis read-path for the weekly breach cron ─────────────── */

/**
 * Parse a sorted-set member back into (value, pass). Members are
 * written as `${value}:${p|f}:${uniq}` by recordSample.
 */
export function parseSampleMember(member: string): { value: number; pass: boolean } | null {
  const firstColon = member.indexOf(":");
  if (firstColon < 1) return null;
  const secondColon = member.indexOf(":", firstColon + 1);
  if (secondColon < 0) return null;

  const valueStr = member.slice(0, firstColon);
  const tag = member.slice(firstColon + 1, secondColon);
  const value = Number(valueStr);
  if (!Number.isFinite(value)) return null;
  if (tag !== "p" && tag !== "f") return null;
  return { value, pass: tag === "p" };
}

/**
 * Aggregate all samples for a SLO over the last N days into a
 * SampleSummary. Reads one Redis key per day (cheap — ~30 round-trips
 * max for a 30-day window).
 *
 * Returns an empty summary if Upstash isn't configured or all reads
 * fail — upstream classifyBreach handles the zero-count case cleanly.
 */
export async function summarizeWindow(
  slo: SLODefinition,
): Promise<SampleSummary> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const summary: SampleSummary = { count: 0, passed: 0, failed: 0, values: [] };
  if (!url || !token) return summary;

  const days = slo.windowDays;
  const now = Date.now();

  // Build the list of day keys to fetch.
  const dayKeys: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000);
    dayKeys.push(`slo:${slo.name}:${d.toISOString().slice(0, 10)}`);
  }

  const fetches = dayKeys.map(async (key) => {
    try {
      // ZRANGE 0 -1 returns all members in ascending score order.
      // We don't need scores; just the member strings.
      const res = await fetch(`${url}/zrange/${encodeURIComponent(key)}/0/-1`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return [] as string[];
      const body = (await res.json()) as { result?: string[] };
      return body.result ?? [];
    } catch {
      return [] as string[];
    }
  });

  const perDay = await Promise.all(fetches);
  for (const members of perDay) {
    for (const m of members) {
      const parsed = parseSampleMember(m);
      if (!parsed) continue;
      summary.count++;
      if (parsed.pass) summary.passed++;
      else summary.failed++;
      summary.values.push(parsed.value);
    }
  }

  return summary;
}

/**
 * Check every configured SLO against its window. Returns the list of
 * BreachReports (both breached and OK) so the cron can decide what to
 * post. Runs all SLOs in parallel — none of them need to block each
 * other since each reads its own Redis keys.
 */
export async function checkAllSLOs(): Promise<BreachReport[]> {
  const jobs = Object.values(SLOS).map(async (slo) => {
    const summary = await summarizeWindow(slo);
    return classifyBreach(slo, summary);
  });
  return Promise.all(jobs);
}
