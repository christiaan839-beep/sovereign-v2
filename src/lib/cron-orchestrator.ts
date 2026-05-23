/**
 * SOVEREIGN MATRIX — Nightly cron orchestrator (Wave 144).
 *
 * The closed-loop daemon. Runs once per day (Vercel Cron / GitHub
 * Action) and:
 *
 *   1. Computes the previous day's Merkle root over all signed
 *      receipts → can be published to GitHub releases / IPFS / Twitter
 *   2. Runs the eval harness, diffs against the stored baseline,
 *      detects regressions per agent
 *   3. Dispatches alerts on regression via outboundFetch (Slack /
 *      Telegram / Discord webhook, all rate-limited)
 *
 * Pure orchestrator design:
 *   `runNightly(deps)` takes injectable deps (buildRoot, evalReport,
 *    fetchBaseline, sendAlert) so every branch is unit-testable
 *   without DB, HTTP, or filesystem.
 *
 * Wire-up:
 *   - /api/cron/nightly POST endpoint (Vercel Cron hits this)
 *   - Optional CRON_SECRET env var — when set, the endpoint requires
 *     `Authorization: Bearer ${CRON_SECRET}` header
 *   - Alert destinations: SLACK_WEBHOOK_URL, TELEGRAM_BOT_TOKEN +
 *     TELEGRAM_CHAT_ID, DISCORD_WEBHOOK_URL. Empty = no alert sent.
 *
 * Idempotency:
 *   - Merkle root computation is deterministic on the receipts —
 *     re-running on the same day produces the same root
 *   - Eval baseline file is read once + replaced atomically only
 *     after the diff completes successfully
 *   - Alert dispatch is best-effort — failures log + continue so
 *     one broken webhook doesn't block the rest of the cron
 */

import type { DailyMerkleSummary } from "@/lib/merkle-receipts";
import type { EvalReport, EvalRegression } from "@/lib/eval-harness";
import { createLogger } from "@/lib/logger";

const log = createLogger("cron-orchestrator");

export interface NightlyDeps {
  /** Build the Merkle root for yesterday (UTC). */
  buildRoot: () => Promise<DailyMerkleSummary>;
  /** Run the eval harness for the configured window. */
  computeEval: () => Promise<EvalReport>;
  /** Load the previous baseline EvalReport, or null on first run. */
  loadBaseline: () => Promise<EvalReport | null>;
  /** Persist the new baseline. */
  saveBaseline: (r: EvalReport) => Promise<void>;
  /** Pure regression detector. */
  detectRegressions: (
    current: EvalReport,
    baseline: EvalReport,
    thresholdPct?: number,
  ) => EvalRegression[];
  /**
   * Dispatch an alert. Each entry is one channel (Slack, Telegram,
   * Discord). Implementation chooses which channels to fire based
   * on env vars. Returns the per-channel success/fail map.
   */
  sendAlert: (msg: string) => Promise<Record<string, boolean>>;
}

export interface NightlyResult {
  generatedAt: string;
  /** Yesterday's UTC day in YYYY-MM-DD. */
  date: string;
  merkleRoot: string;
  receiptCount: number;
  evalAvgScore: number;
  evalSampleSize: number;
  regressions: EvalRegression[];
  alertsFired: Record<string, boolean>;
  /** Errors that the orchestrator swallowed, for operator visibility. */
  warnings: string[];
}

export interface NightlyOptions {
  /** Regression threshold percentage. Default 5. */
  regressionThresholdPct?: number;
  /** Skip alert dispatch entirely (dry-run). */
  dryRun?: boolean;
}

/**
 * Pure orchestrator — runs the three steps with the injected deps
 * and returns a structured result. Each step is wrapped in try/catch
 * so one failure never blocks the others.
 */
export async function runNightly(
  deps: NightlyDeps,
  opts: NightlyOptions = {},
): Promise<NightlyResult> {
  const warnings: string[] = [];

  // ─── Step 1: Merkle root ───
  let merkle: DailyMerkleSummary | null = null;
  try {
    merkle = await deps.buildRoot();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`buildRoot failed: ${msg}`);
    log.warn("buildRoot threw", { error: msg });
  }

  // ─── Step 2: Eval + regression detect ───
  let evalReport: EvalReport | null = null;
  let regressions: EvalRegression[] = [];
  try {
    evalReport = await deps.computeEval();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`computeEval failed: ${msg}`);
    log.warn("computeEval threw", { error: msg });
  }

  if (evalReport) {
    try {
      const baseline = await deps.loadBaseline();
      if (baseline) {
        regressions = deps.detectRegressions(
          evalReport,
          baseline,
          opts.regressionThresholdPct ?? 5,
        );
      }
      // Persist the new baseline regardless of regression result
      await deps.saveBaseline(evalReport);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`baseline rotate failed: ${msg}`);
      log.warn("baseline rotate threw", { error: msg });
    }
  }

  // ─── Step 3: Alert dispatch ───
  let alertsFired: Record<string, boolean> = {};
  if (!opts.dryRun && (regressions.length > 0 || warnings.length > 0)) {
    const summary = renderAlertSummary({
      date: merkle?.date ?? "(unknown)",
      receiptCount: merkle?.leafCount ?? 0,
      regressions,
      warnings,
    });
    try {
      alertsFired = await deps.sendAlert(summary);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`sendAlert failed: ${msg}`);
      log.warn("sendAlert threw", { error: msg });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    date: merkle?.date ?? new Date().toISOString().slice(0, 10),
    merkleRoot: merkle?.root ?? "",
    receiptCount: merkle?.leafCount ?? 0,
    evalAvgScore: evalReport?.overall.avgScore ?? 0,
    evalSampleSize: evalReport?.totalRowsScored ?? 0,
    regressions,
    alertsFired,
    warnings,
  };
}

/**
 * Pure alert-message renderer — returns a plain-text summary safe
 * for any chat webhook. Markdown-friendly (Slack/Discord/Telegram
 * all parse the same backtick + bullet conventions).
 */
export function renderAlertSummary(args: {
  date: string;
  receiptCount: number;
  regressions: EvalRegression[];
  warnings: string[];
}): string {
  const lines: string[] = [];
  lines.push(`*Sovereign Matrix nightly digest — ${args.date}*`);
  lines.push("");
  lines.push(`• Receipts signed: ${args.receiptCount.toLocaleString()}`);
  if (args.regressions.length > 0) {
    lines.push(`• Eval REGRESSIONS: ${args.regressions.length}`);
    for (const r of args.regressions.slice(0, 10)) {
      lines.push(
        `   ‣ \`${r.agentName}\` — ${r.baselineScore.toFixed(3)} → ${r.currentScore.toFixed(3)} (-${r.pctDrop}%)`,
      );
    }
  } else {
    lines.push("• Eval regressions: none ✅");
  }
  if (args.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    for (const w of args.warnings.slice(0, 5)) {
      lines.push(`   • ${w}`);
    }
  }
  return lines.join("\n");
}
