/**
 * SOVEREIGN MATRIX — Auto-bandit seeding (Wave 149).
 *
 * Eliminates the only manual step in the closed-loop self-improvement
 * pipeline. Before this, every agent had to be hand-seeded via
 *   POST /api/admin/bandit { agent, models: [...] }
 * before the Thompson sampler could route through it.
 *
 * Now: the bandit auto-discovers (agent × model) pairs from the
 * recent `agent_runs` history and seeds Beta(1,1) arms on first
 * sighting. No human in the loop.
 *
 * Algorithm:
 *   1. Scan agent_runs for the last `windowDays` days
 *   2. Group by (agentName, modelUsed) — model strings only
 *   3. For each pair with ≥ minSamples runs, ensure a bandit arm
 *      exists. Existing arms are untouched (we don't reset learning).
 *   4. Return the per-agent seed map for operator visibility
 *
 * Wire-up:
 *   - Lib export `runAutoSeed(opts)` — pure DB + agent-attribution work
 *   - POST /api/admin/bandit/autoseed — admin-triggered explicit run
 *   - Nightly cron daemon (Wave 144) calls this automatically at the
 *     same 04:15 UTC slot
 *
 * Idempotency: safe to re-run any number of times. Existing arms are
 * preserved (we INSERT ... ON CONFLICT DO NOTHING).
 */

import { db } from "@/db";
import { sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("bandit-autoseed");

const DEFAULT_WINDOW_DAYS = 30;
const DEFAULT_MIN_SAMPLES = 3;

/** Skip these "model" values — they're factory placeholders, not real arms. */
const SKIP_MODELS = new Set(["agent-factory", "unknown", "", "n/a", "none"]);

export interface AutoSeedSummary {
  generatedAt: string;
  windowDays: number;
  minSamples: number;
  /** Total (agent × model) pairs discovered above minSamples. */
  pairsDiscovered: number;
  /** New arms inserted on this run. */
  armsSeeded: number;
  /** Existing arms preserved (ON CONFLICT DO NOTHING). */
  armsExisting: number;
  /** Per-agent arms inventory after the run. */
  perAgent: Array<{
    agentName: string;
    models: string[];
    samples: number;
  }>;
}

/**
 * Pure aggregator — takes raw rows + thresholds, returns the
 * (agent × model) pairs that should be seeded.
 *
 * Exported for tests.
 */
export function buildSeedPlan(
  rows: Array<{ agent_name: string; model_used: string }>,
  minSamples: number = DEFAULT_MIN_SAMPLES,
): Map<string, { models: Set<string>; samples: number }> {
  const counts = new Map<
    string,
    { agentName: string; modelUsed: string; n: number }
  >();
  for (const r of rows) {
    if (!r.agent_name || SKIP_MODELS.has(r.model_used)) continue;
    const key = `${r.agent_name}::${r.model_used}`;
    const cur = counts.get(key);
    if (cur) {
      cur.n += 1;
    } else {
      counts.set(key, {
        agentName: r.agent_name,
        modelUsed: r.model_used,
        n: 1,
      });
    }
  }

  const plan = new Map<string, { models: Set<string>; samples: number }>();
  for (const v of counts.values()) {
    if (v.n < minSamples) continue;
    const cur = plan.get(v.agentName);
    if (cur) {
      cur.models.add(v.modelUsed);
      cur.samples += v.n;
    } else {
      plan.set(v.agentName, {
        models: new Set([v.modelUsed]),
        samples: v.n,
      });
    }
  }
  return plan;
}

async function ensureBanditTable(): Promise<boolean> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS model_bandit_arms (
        agent_name TEXT NOT NULL,
        task_class TEXT NOT NULL DEFAULT 'default',
        model TEXT NOT NULL,
        alpha INTEGER NOT NULL DEFAULT 1,
        beta INTEGER NOT NULL DEFAULT 1,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (agent_name, task_class, model)
      )
    `);
    return true;
  } catch (err) {
    log.warn("bandit table ensure failed", { error: String(err) });
    return false;
  }
}

/**
 * Live auto-seed run. Pulls recent agent_runs, computes the plan,
 * inserts new arms with ON CONFLICT DO NOTHING (preserves existing
 * Beta posteriors). Returns the summary for operator visibility.
 *
 * Fail-soft on missing tables — returns an empty summary.
 */
export async function runAutoSeed(
  opts: {
    windowDays?: number;
    minSamples?: number;
  } = {},
): Promise<AutoSeedSummary> {
  const windowDays = Math.min(
    Math.max(opts.windowDays ?? DEFAULT_WINDOW_DAYS, 1),
    365,
  );
  const minSamples = Math.max(opts.minSamples ?? DEFAULT_MIN_SAMPLES, 1);
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const empty: AutoSeedSummary = {
    generatedAt: new Date().toISOString(),
    windowDays,
    minSamples,
    pairsDiscovered: 0,
    armsSeeded: 0,
    armsExisting: 0,
    perAgent: [],
  };

  const ready = await ensureBanditTable();
  if (!ready) return empty;

  let rows: Array<{ agent_name: string; model_used: string }>;
  try {
    const r = (await db.execute(sql`
      SELECT agent_name, model_used
      FROM agent_runs
      WHERE created_at > ${since.toISOString()}
        AND duration_ms > 0
    `)) as unknown as {
      rows?: Array<{ agent_name: string; model_used: string }>;
    };
    rows = Array.isArray(r)
      ? (r as unknown as Array<{ agent_name: string; model_used: string }>)
      : (r.rows ?? []);
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "42P01") return empty;
    log.warn("auto-seed scan failed", { error: String(err) });
    return empty;
  }

  const plan = buildSeedPlan(rows, minSamples);
  let pairsDiscovered = 0;
  let armsSeeded = 0;
  let armsExisting = 0;
  const perAgent: AutoSeedSummary["perAgent"] = [];

  for (const [agentName, { models, samples }] of plan.entries()) {
    pairsDiscovered += models.size;
    perAgent.push({ agentName, models: [...models], samples });
    for (const model of models) {
      try {
        const r = (await db.execute(sql`
          INSERT INTO model_bandit_arms (agent_name, task_class, model, alpha, beta)
          VALUES (${agentName}, 'default', ${model}, 1, 1)
          ON CONFLICT (agent_name, task_class, model) DO NOTHING
          RETURNING agent_name
        `)) as unknown as { rows?: Array<unknown>; rowCount?: number };
        // pg returns rowCount; Drizzle's HTTP driver returns rows array
        const inserted = Array.isArray(r)
          ? (r as unknown as Array<unknown>).length
          : (r.rows?.length ?? r.rowCount ?? 0);
        if (inserted > 0) armsSeeded++;
        else armsExisting++;
      } catch (err) {
        log.warn("auto-seed insert failed", {
          agentName,
          model,
          error: String(err),
        });
      }
    }
  }

  perAgent.sort((a, b) => b.samples - a.samples);

  return {
    generatedAt: new Date().toISOString(),
    windowDays,
    minSamples,
    pairsDiscovered,
    armsSeeded,
    armsExisting,
    perAgent,
  };
}
