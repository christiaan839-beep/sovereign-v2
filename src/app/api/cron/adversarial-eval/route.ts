/**
 * GET /api/cron/adversarial-eval
 *
 * Daily Vercel cron. Runs the frozen adversarial corpus against the
 * live jailbreak detector and persists the result (signed, fingerprint-
 * bound) to audit_logs as `adversarial.eval`. The result is then read
 * by `/api/security/eval` for public verification.
 *
 * Security: requires CRON_SECRET in the `x-cron-secret` header. The
 * cron is the only writer of `adversarial.eval` rows — the public
 * endpoint is read-only.
 *
 * Honesty: this runs the FAST PATH only. Slow-path NIM eval requires
 * an external API key + adds significant latency; we run it inline
 * here only when NVIDIA_NIM_API_KEY is configured. Operators who want
 * the higher number should ensure that key is set on the cron's
 * deployment.
 */

import { NextResponse } from "next/server";
import { runAdversarialEval } from "@/lib/adversarial-eval";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";

const log = createLogger("cron-adversarial-eval");

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = req.headers.get("x-cron-secret");
  if (!secret || supplied !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let result;
  try {
    result = await runAdversarialEval();
  } catch (err) {
    // runAdversarialEval is internally fault-tolerant (per-prompt
    // catches), so a throw here means a genuine module-level failure
    // (import problem, env issue). Surface a 503 so the cron alerts.
    log.error("adversarial eval threw at module level", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { ok: false, reason: "eval failed" },
      { status: 503 },
    );
  }

  // Persist as audit row. Best-effort — never fail the cron because of
  // a transient DB error; the result is also returned in the response
  // body so an operator can recover it from the cron log.
  try {
    await auditLog({
      userId: "system",
      action: "adversarial.eval",
      resource: `corpus:${result.corpusFingerprint.slice(0, 16)}`,
      details: {
        schema: result.schema,
        ranAt: result.ranAt,
        durationMs: result.durationMs,
        corpusFingerprint: result.corpusFingerprint,
        attack: result.attack,
        benign: result.benign,
        compositeScore: result.compositeScore,
        mldsa65Sig: result.mldsa65Sig,
        pqEnabled: result.pqEnabled,
      },
    });
  } catch (err) {
    log.warn("adversarial.eval audit write failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  log.info("Adversarial eval complete", {
    blocked: result.attack.blocked,
    total: result.attack.total,
    blockRate: result.attack.blockRate,
    falsePositives: result.benign.falsePositives,
    durationMs: result.durationMs,
  });

  return NextResponse.json({
    ok: true,
    ranAt: result.ranAt,
    blockRate: result.attack.blockRate,
    blocked: result.attack.blocked,
    total: result.attack.total,
    falsePositives: result.benign.falsePositives,
    compositeScore: result.compositeScore,
    corpusFingerprint: result.corpusFingerprint,
    durationMs: result.durationMs,
  });
}
