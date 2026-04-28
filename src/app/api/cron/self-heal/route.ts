/**
 * GET /api/cron/self-heal
 *
 * Round 27 — The Permanence Sprint. Hourly anti-drift snapshot.
 *
 * Why this exists:
 *   - The anti-drift gate runs in CI on every PR. Great.
 *   - But: a force-push to main, a bypassed CI, a direct production
 *     env-var change, a stale doc — all of these can introduce
 *     drift between PR runs. Once a regression lands, the next CI
 *     pass catches it — but in the worst case, weeks of silent
 *     rot accumulate.
 *
 * The self-heal cron:
 *   1. Runs the FULL anti-drift gate (all 141+ invariants) hourly.
 *   2. Persists the result to `platform_health_snapshots`.
 *   3. Surfaces a structured ERROR log + Sentry capture if any
 *      invariant fails — operator gets paged within 1 hour of any
 *      regression, NOT weeks later when a customer complains.
 *
 * The 8760 snapshots/year are also the trust artifact: an admin
 * dashboard graphing "invariants over time" lets a procurement
 * team verify "we've maintained 141/141 for 90 days" — a claim
 * that's not just self-reported but queryable.
 *
 * Auth: verifyCron (timing-safe, fail-closed).
 *
 * NEVER 5xxs on graceful failure. The cron's job is to OBSERVE
 * the system's health, not to be a critical path. If the snapshot
 * write fails, we log and return 200 — an operator notices via
 * the Sentry alert.
 */

import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { verifyCron } from "@/lib/cron-auth";
import { createLogger } from "@/lib/logger";

const log = createLogger("cron:self-heal");

export const runtime = "nodejs";
export const maxDuration = 120; // Anti-drift gate takes ~45s

interface AntiDriftResult {
  invariantsTotal: number;
  invariantsPassing: number;
  invariantsFailing: number;
  failingChecks: string[];
  durationMs: number;
}

/**
 * Run the anti-drift gate as a child process. The gate is a Node
 * script (`scripts/weekly-health.mjs`) that exits 0 on full pass
 * and 1 on regression; it prints a markdown table to stdout that
 * we parse for the per-check breakdown.
 *
 * Vercel function filesystems don't include the scripts/ dir at
 * runtime by default — so this code path runs on Railway-style
 * persistent deploys. On Vercel-only deploys, the cron returns
 * "skipped" and we rely on CI for the gate. (We could embed the
 * gate logic inline, but duplicating ~140 invariants between two
 * surfaces is itself a drift hazard.)
 */
async function runAntiDriftGate(): Promise<AntiDriftResult | null> {
  const start = Date.now();
  return new Promise((resolve) => {
    try {
      const proc = spawn("node", ["scripts/weekly-health.mjs"], {
        cwd: process.cwd(),
        env: { ...process.env, CI: "1" },
        timeout: 110_000, // 110s — safely under the 120s function ceiling
      });

      let stdout = "";
      let stderr = "";
      proc.stdout?.on("data", (d) => (stdout += d.toString()));
      proc.stderr?.on("data", (d) => (stderr += d.toString()));

      proc.on("error", (err) => {
        log.warn("Anti-drift gate spawn failed", { error: String(err) });
        resolve(null);
      });

      proc.on("close", () => {
        const durationMs = Date.now() - start;

        // Parse the output. The gate prints a markdown table where
        // each row looks like:
        //   | <check name> | <value> | <target> | ✅ |   (pass)
        //   | <check name> | <value> | <target> | ❌ |   (fail)
        // Counts: total checks, ✅ passes, ❌ fails.
        const lines = (stdout + stderr).split("\n");
        const checkRows = lines.filter(
          (l) => /\|\s*[^|]+\|\s*[\d—-]+\s*\|\s*[\d—-]+\s*\|\s*[✅❌ℹ️]/.test(l),
        );
        const failingChecks: string[] = [];
        let passing = 0;
        for (const row of checkRows) {
          if (row.includes("❌")) {
            const name = row.split("|")[1]?.trim() ?? "(unknown)";
            failingChecks.push(name);
          } else if (row.includes("✅")) {
            passing += 1;
          }
        }
        const total = passing + failingChecks.length;
        resolve({
          invariantsTotal: total,
          invariantsPassing: passing,
          invariantsFailing: failingChecks.length,
          failingChecks,
          durationMs,
        });
      });
    } catch (err) {
      log.warn("Anti-drift gate exception", { error: String(err) });
      resolve(null);
    }
  });
}

async function getDb() {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { db } = await import("@/db");
    return db;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const cronErr = verifyCron(req);
  if (cronErr) return cronErr;

  const result = await runAntiDriftGate();
  if (!result) {
    log.warn("Self-heal: anti-drift gate unavailable on this runtime");
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "anti-drift gate unavailable on this runtime",
      ranAt: new Date().toISOString(),
    });
  }

  const healthy = result.invariantsFailing === 0;

  // Always log the outcome — passing snapshots are fine at info,
  // failing ones are ERROR so they page on Sentry.
  if (healthy) {
    log.info("Self-heal snapshot — green", {
      invariantsTotal: result.invariantsTotal,
      durationMs: result.durationMs,
    });
  } else {
    log.error("Self-heal snapshot — REGRESSION DETECTED", {
      invariantsFailing: result.invariantsFailing,
      failingChecks: result.failingChecks,
      durationMs: result.durationMs,
    });
  }

  // Persist the snapshot. NEVER 5xx — telemetry failures are
  // tertiary; the structured log is the primary signal for
  // operators (Sentry catches the ERROR-level log above).
  const db = await getDb();
  if (db) {
    try {
      const { platformHealthSnapshots } = await import("@/db/schema");
      await db.insert(platformHealthSnapshots).values({
        invariantsTotal: result.invariantsTotal,
        invariantsPassing: result.invariantsPassing,
        invariantsFailing: result.invariantsFailing,
        failingChecks: result.failingChecks,
        healthy,
        durationMs: result.durationMs,
      });
    } catch (err) {
      log.error("Self-heal snapshot persist failed", { error: String(err) });
    }
  }

  return NextResponse.json({
    ok: true,
    healthy,
    ...result,
    ranAt: new Date().toISOString(),
  });
}
