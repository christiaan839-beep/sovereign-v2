/**
 * SOVEREIGN MATRIX — Thompson-sampling model bandit (Wave 139).
 *
 * Adaptive routing intelligence. The platform watches itself and
 * rewires its own routing decisions in real time. Per-(agent ×
 * task-class) pair, picks the model with the best posterior over
 * reward (auto-approved ÷ samples).
 *
 * Why Thompson sampling over UCB / epsilon-greedy:
 *   - Naturally calibrated — confidence intervals fall as evidence grows
 *   - Optimal regret bounds in the Beta(alpha, beta) conjugate-prior case
 *   - Cheap to compute (one Beta sample per arm per call)
 *   - Cold-start handling is built in via the Beta(1,1) uniform prior
 *
 * Pure-function design:
 *   - `pickArm(arms, rng?)` is the core selection — fully testable
 *   - `updateArm(state, outcome)` mutates a per-arm count
 *   - `BanditState` is a JSON-serialisable shape that maps to the
 *     `model_bandit_arms` table (created in migration 0027)
 *
 * Wiring:
 *   - smartAi() can opt in by calling `pickArmAsync(agentName, taskClass)`
 *   - Outcomes recorded after every call via `recordOutcome()`
 *   - Falls through gracefully when DB is unavailable — never blocks
 *     the actual AI call
 */

import { db } from "@/db";
import { sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("model-bandit");

/** A single arm — one (agentName, taskClass, model) tuple. */
export interface BanditArm {
  model: string;
  /** Number of positive outcomes (auto-approved / preferred). */
  alpha: number;
  /** Number of negative outcomes (blocked / needs-approval / failed). */
  beta: number;
}

export interface BanditPick {
  model: string;
  /** The sampled Beta value used to select. Useful for debugging. */
  sampledValue: number;
  /** Posterior mean — alpha / (alpha + beta). */
  posteriorMean: number;
}

/**
 * Beta(α, β) sample using the inverse-transform / Marsaglia-Tsang
 * approximation via two Gamma samples. The Math.random fallback
 * default is fine for our scale; rng injectable for tests.
 */
export function betaSample(
  alpha: number,
  beta: number,
  rng: () => number = Math.random,
): number {
  // For α, β both > 0. Use the ratio of two Gamma(α, 1) variates.
  const x = gammaSample(alpha, rng);
  const y = gammaSample(beta, rng);
  if (x + y === 0) return 0.5;
  return x / (x + y);
}

/** Marsaglia-Tsang Gamma sampler — handles all α > 0. */
function gammaSample(alpha: number, rng: () => number): number {
  if (alpha < 1) {
    const u = rng();
    return gammaSample(alpha + 1, rng) * Math.pow(u, 1 / alpha);
  }
  const d = alpha - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  while (true) {
    let x: number;
    let v: number;
    do {
      // Box-Muller for a standard normal
      const u1 = rng();
      const u2 = rng();
      x = Math.sqrt(-2 * Math.log(u1 || 1e-12)) * Math.cos(2 * Math.PI * u2);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u || 1e-12) < 0.5 * x * x + d * (1 - v + Math.log(v)))
      return d * v;
  }
}

/**
 * Pure selector — picks the arm with the highest sampled Beta value.
 * Returns null on empty arm list.
 */
export function pickArm(
  arms: BanditArm[],
  rng: () => number = Math.random,
): BanditPick | null {
  if (arms.length === 0) return null;
  let bestSample = -Infinity;
  let best: BanditArm | null = null;
  for (const arm of arms) {
    const a = Math.max(1, arm.alpha);
    const b = Math.max(1, arm.beta);
    const sample = betaSample(a, b, rng);
    if (sample > bestSample) {
      bestSample = sample;
      best = arm;
    }
  }
  if (!best) return null;
  return {
    model: best.model,
    sampledValue: bestSample,
    posteriorMean: best.alpha / (best.alpha + best.beta || 1),
  };
}

/** Pure outcome update — returns a new arm with incremented counter. */
export function updateArm(arm: BanditArm, positive: boolean): BanditArm {
  return {
    ...arm,
    alpha: positive ? arm.alpha + 1 : arm.alpha,
    beta: positive ? arm.beta : arm.beta + 1,
  };
}

/**
 * Compute a per-arm exploration "regret bound" — used by the admin
 * panel to surface arms that need more samples before promotion.
 */
export function explorationGap(arm: BanditArm): number {
  const n = arm.alpha + arm.beta;
  if (n === 0) return 1;
  // 95% confidence half-width of the Beta posterior
  const p = arm.alpha / n;
  const stderr = Math.sqrt((p * (1 - p)) / (n + 1));
  return Number((1.96 * stderr).toFixed(4));
}

interface ArmRow {
  model: string;
  alpha: number;
  beta: number;
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
 * DB-backed arm fetch. Returns the registered arms for a given
 * (agent × task-class). Operators pre-seed via the admin route.
 */
export async function loadArms(
  agentName: string,
  taskClass: string = "default",
): Promise<BanditArm[]> {
  const ready = await ensureBanditTable();
  if (!ready) return [];
  try {
    const rows = (await db.execute(sql`
      SELECT model, alpha, beta
      FROM model_bandit_arms
      WHERE agent_name = ${agentName} AND task_class = ${taskClass}
    `)) as unknown as { rows: ArmRow[] };
    const arr = Array.isArray(rows)
      ? (rows as unknown as ArmRow[])
      : (rows.rows ?? []);
    return arr.map((r) => ({ model: r.model, alpha: r.alpha, beta: r.beta }));
  } catch (err) {
    log.warn("loadArms failed", { error: String(err), agentName });
    return [];
  }
}

/**
 * High-level pick — loads arms from DB, samples, returns the chosen
 * model. Returns null when no arms are registered (caller should
 * fall through to default routing).
 */
export async function pickArmAsync(
  agentName: string,
  taskClass: string = "default",
): Promise<BanditPick | null> {
  const arms = await loadArms(agentName, taskClass);
  if (arms.length === 0) return null;
  return pickArm(arms);
}

/**
 * Record an outcome — increments alpha (positive) or beta (negative).
 * Best-effort — DB failures never bubble to the caller.
 */
export async function recordOutcome(
  agentName: string,
  taskClass: string,
  model: string,
  positive: boolean,
): Promise<void> {
  const ready = await ensureBanditTable();
  if (!ready) return;
  try {
    if (positive) {
      await db.execute(sql`
        INSERT INTO model_bandit_arms (agent_name, task_class, model, alpha, beta, updated_at)
        VALUES (${agentName}, ${taskClass}, ${model}, 2, 1, now())
        ON CONFLICT (agent_name, task_class, model)
        DO UPDATE SET alpha = model_bandit_arms.alpha + 1, updated_at = now()
      `);
    } else {
      await db.execute(sql`
        INSERT INTO model_bandit_arms (agent_name, task_class, model, alpha, beta, updated_at)
        VALUES (${agentName}, ${taskClass}, ${model}, 1, 2, now())
        ON CONFLICT (agent_name, task_class, model)
        DO UPDATE SET beta = model_bandit_arms.beta + 1, updated_at = now()
      `);
    }
  } catch (err) {
    log.warn("recordOutcome failed", {
      error: String(err),
      agentName,
      model,
    });
  }
}

/** Admin-facing report — all arms for one agent with exploration gap. */
export async function describeArms(agentName: string): Promise<
  Array<
    BanditArm & {
      taskClass: string;
      posteriorMean: number;
      explorationGap: number;
      totalSamples: number;
    }
  >
> {
  const ready = await ensureBanditTable();
  if (!ready) return [];
  try {
    const rows = (await db.execute(sql`
      SELECT task_class, model, alpha, beta
      FROM model_bandit_arms
      WHERE agent_name = ${agentName}
      ORDER BY task_class, model
    `)) as unknown as {
      rows: Array<{
        task_class: string;
        model: string;
        alpha: number;
        beta: number;
      }>;
    };
    const arr = Array.isArray(rows)
      ? (rows as unknown as Array<{
          task_class: string;
          model: string;
          alpha: number;
          beta: number;
        }>)
      : (rows.rows ?? []);
    return arr.map((r) => ({
      model: r.model,
      taskClass: r.task_class,
      alpha: r.alpha,
      beta: r.beta,
      posteriorMean: Number(
        (r.alpha / Math.max(1, r.alpha + r.beta)).toFixed(4),
      ),
      explorationGap: explorationGap({
        model: r.model,
        alpha: r.alpha,
        beta: r.beta,
      }),
      totalSamples: r.alpha + r.beta - 2, // subtract uniform prior
    }));
  } catch (err) {
    log.warn("describeArms failed", { error: String(err), agentName });
    return [];
  }
}
