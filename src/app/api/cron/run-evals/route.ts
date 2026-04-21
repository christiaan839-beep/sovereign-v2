import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { db } from "@/db";
import { evalRuns, evalRunResults } from "@/db/schema";
import { and, eq, desc, lt } from "drizzle-orm";
import { getBaseUrl } from "@/lib/base-url";
import { createLogger } from "@/lib/logger";
import { detectDrift, type EvalRunSummary, type EvalResultRow } from "@/lib/eval-drift";

const log = createLogger("run-evals-cron");

/**
 * GET /api/cron/run-evals
 *
 * Runs every 6 hours. Loads the golden-set registry, hits each agent's
 * /api/agents/<slug> endpoint with the registered input, validates
 * output against the Zod expect + any free-form assertions, persists
 * results, and compares to the previous run for drift.
 *
 * Why self-HTTP instead of calling runPlaybookStep / agent-factory
 * directly: the golden set was designed to exercise the full public
 * agent surface. Running evals against the same surface a customer
 * hits catches integration issues (factory wiring, auth bypass,
 * middleware) that direct function calls miss.
 *
 * On drift: logs a Sentry warning with full context. Does NOT block or
 * retry — surfacing the signal is the whole job. Upstream decides
 * whether to rollback a deploy, update the eval, or investigate.
 */

export const runtime = "nodejs";
export const maxDuration = 300; // up to 5 min for the full suite

interface EvalExecResult {
  evalSlug: string;
  agentSlug: string;
  status: "passed" | "failed" | "skipped";
  durationMs: number;
  errorMessage: string | null;
  outputHash: string | null;
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Lazy-import the golden set so the harness registration runs
  const { getAllEvals } = await import("@/lib/__tests__/agent-evals/harness");
  await import("@/lib/__tests__/agent-evals/golden-set");
  const evals = getAllEvals();

  if (evals.length === 0) {
    return NextResponse.json({ ok: false, error: "No evals registered" }, { status: 500 });
  }

  // Open the run row
  const [runRow] = await db
    .insert(evalRuns)
    .values({ trigger: "scheduled", total: evals.length })
    .returning();

  const results: EvalExecResult[] = [];
  const baseUrl = getBaseUrl();
  const started = Date.now();

  for (const ev of evals) {
    // Skip when provider keys are missing
    if (ev.skipIf?.()) {
      results.push({
        evalSlug: ev.slug,
        agentSlug: ev.slug,
        status: "skipped",
        durationMs: 0,
        errorMessage: null,
        outputHash: null,
      });
      continue;
    }

    const evStart = Date.now();
    try {
      // Invoke the agent with internal-auth headers so the factory
      // treats it as trusted. Use a service-identity userId so the
      // eval doesn't contaminate a real user's credit/activity data.
      const res = await fetch(`${baseUrl}/api/agents/${ev.slug}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Sovereign-Internal-Secret": process.env.CRON_SECRET,
          "X-Sovereign-User-Id": "eval_runner",
        },
        body: JSON.stringify({ ...(ev.input as object), confirmed: true }),
        signal: AbortSignal.timeout(ev.timeoutMs ?? 30_000),
      });
      const body = await res.json().catch(() => null);

      if (!res.ok || !body) {
        throw new Error(`HTTP ${res.status}: ${JSON.stringify(body)?.slice(0, 200)}`);
      }

      // Validate against the eval's Zod schema
      const parsed = ev.expect.safeParse(body);
      if (!parsed.success) {
        throw new Error(`Schema mismatch: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
      }

      // Run the free-form assertions
      if (ev.assertions) {
        await ev.assertions(parsed.data);
      }

      results.push({
        evalSlug: ev.slug,
        agentSlug: ev.slug,
        status: "passed",
        durationMs: Date.now() - evStart,
        errorMessage: null,
        outputHash: canonicalHash(body),
      });
    } catch (err) {
      results.push({
        evalSlug: ev.slug,
        agentSlug: ev.slug,
        status: "failed",
        durationMs: Date.now() - evStart,
        errorMessage: (err as Error).message.slice(0, 500),
        outputHash: null,
      });
    }
  }

  // Persist per-eval results
  await db.insert(evalRunResults).values(
    results.map((r) => ({
      runId: runRow.id,
      evalSlug: r.evalSlug,
      agentSlug: r.agentSlug,
      status: r.status,
      durationMs: r.durationMs,
      errorMessage: r.errorMessage,
      outputHash: r.outputHash,
    })),
  );

  // Roll up
  const passed = results.filter((r) => r.status === "passed").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const effective = results.length - skipped;
  const passRate = effective > 0 ? passed / effective : 0;

  await db
    .update(evalRuns)
    .set({
      completedAt: new Date(),
      total: results.length,
      passed,
      failed,
      skipped,
      durationMs: Date.now() - started,
      passRate: String(passRate),
    })
    .where(eq(evalRuns.id, runRow.id));

  // ─── Drift detection ───
  const previous = await loadPreviousRun(runRow.id);
  const currentSummary: EvalRunSummary = {
    id: runRow.id,
    passRate,
    passed,
    failed,
    skipped,
    total: results.length,
  };
  const currentResults: EvalResultRow[] = results.map((r) => ({
    evalSlug: r.evalSlug,
    agentSlug: r.agentSlug,
    status: r.status,
    outputHash: r.outputHash,
  }));

  const drift = detectDrift(previous, { summary: currentSummary, results: currentResults });

  if (drift.drifted) {
    // Lazy-import Sentry so the route doesn't pull it in when
    // SENTRY_DSN is absent.
    try {
      const Sentry = await import("@sentry/nextjs");
      Sentry.captureMessage(`Eval drift detected: ${drift.summary}`, {
        level: drift.severity === "critical" ? "error" : "warning",
        tags: {
          area: "evals",
          severity: drift.severity,
          pass_rate_delta_pp: String(Math.round(drift.passRateDeltaPp)),
        },
        extra: {
          previousRunId: previous?.summary.id,
          currentRunId: runRow.id,
          newlyFailed: drift.newlyFailed,
          newlyPassed: drift.newlyPassed,
          silentDrift: drift.silentDrift,
          currentPassRate: passRate,
          previousPassRate: previous?.summary.passRate,
        },
      });
    } catch { /* Sentry not configured; log path below still fires */ }
    log.warn("Eval drift detected", {
      severity: drift.severity,
      summary: drift.summary,
      newlyFailed: drift.newlyFailed.length,
      silentDrift: drift.silentDrift.length,
    });
  } else {
    log.info("Evals completed — no drift", {
      passRate,
      passed,
      failed,
      skipped,
      durationMs: Date.now() - started,
    });
  }

  return NextResponse.json({
    ok: true,
    runId: runRow.id,
    total: results.length,
    passed,
    failed,
    skipped,
    passRate,
    drift,
  });
}

/** SHA-256 of canonical JSON — stable under key reordering. */
function canonicalHash(value: unknown): string {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalize).join(",") + "]";
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize((value as Record<string, unknown>)[k])).join(",") + "}";
}

/**
 * Load the most recent completed eval_run PRIOR to this one, plus its
 * per-result rows, for drift comparison.
 */
async function loadPreviousRun(
  currentRunId: string,
): Promise<{ summary: EvalRunSummary; results: EvalResultRow[] } | null> {
  const [prev] = await db
    .select()
    .from(evalRuns)
    .where(and(lt(evalRuns.startedAt, new Date()), /* not the current run */ eq(evalRuns.trigger, "scheduled")))
    .orderBy(desc(evalRuns.startedAt))
    .limit(2); // skip 1 — the current row

  if (!prev || prev.id === currentRunId) return null;

  const rows = await db
    .select()
    .from(evalRunResults)
    .where(eq(evalRunResults.runId, prev.id));

  return {
    summary: {
      id: prev.id,
      passRate: Number(prev.passRate ?? "0"),
      passed: prev.passed,
      failed: prev.failed,
      skipped: prev.skipped,
      total: prev.total,
    },
    results: rows.map((r) => ({
      evalSlug: r.evalSlug,
      agentSlug: r.agentSlug,
      status: r.status as "passed" | "failed" | "skipped",
      outputHash: r.outputHash,
    })),
  };
}
