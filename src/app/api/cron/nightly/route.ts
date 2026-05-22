/**
 * POST /api/cron/nightly
 *
 * Vercel Cron / GitHub Action entry point. Runs the nightly
 * orchestrator (Merkle root + eval harness + alert dispatch) and
 * returns the result as JSON.
 *
 * Auth (two modes):
 *   1. `CRON_SECRET` env var set → require `Authorization: Bearer X`
 *   2. Vercel Cron sets `x-vercel-cron: 1` header automatically →
 *      accept that as a trusted signal
 *
 * Without either, the endpoint refuses. This prevents random
 * unauthenticated callers from triggering expensive nightly work.
 *
 * Idempotency: re-running on the same day produces the same Merkle
 * root + a fresh eval baseline overwrite. Safe to retry.
 */
import { NextResponse } from "next/server";
import { runNightly } from "@/lib/cron-orchestrator";
import { buildDailyRoot } from "@/lib/merkle-receipts";
import {
  computeEvalReport,
  detectRegressions,
  type EvalReport,
} from "@/lib/eval-harness";
import { sendCronAlert } from "@/lib/cron-alerts";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { timingSafeEqual } from "node:crypto";

const log = createLogger("cron-nightly");

function isAuthorised(req: Request): boolean {
  const vercelHeader = req.headers.get("x-vercel-cron");
  if (vercelHeader === "1") return true;

  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false; // no secret + no vercel → refuse

  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  const presented = auth.slice("Bearer ".length).trim();
  const a = Buffer.from(presented);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function ensureBaselineTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS eval_baseline (
        slot TEXT PRIMARY KEY,
        report_json TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  } catch (err) {
    log.warn("eval_baseline ensure failed", { error: String(err) });
  }
}

async function loadBaseline(): Promise<EvalReport | null> {
  await ensureBaselineTable();
  try {
    const r = (await db.execute(sql`
      SELECT report_json FROM eval_baseline WHERE slot = 'nightly'
    `)) as unknown as { rows?: Array<{ report_json: string }> };
    const rows = Array.isArray(r)
      ? (r as unknown as Array<{ report_json: string }>)
      : (r.rows ?? []);
    if (rows.length === 0) return null;
    try {
      return JSON.parse(rows[0].report_json) as EvalReport;
    } catch {
      return null;
    }
  } catch (err) {
    log.warn("loadBaseline failed", { error: String(err) });
    return null;
  }
}

async function saveBaseline(report: EvalReport): Promise<void> {
  await ensureBaselineTable();
  try {
    const json = JSON.stringify(report);
    await db.execute(sql`
      INSERT INTO eval_baseline (slot, report_json, updated_at)
      VALUES ('nightly', ${json}, now())
      ON CONFLICT (slot)
      DO UPDATE SET report_json = ${json}, updated_at = now()
    `);
  } catch (err) {
    log.warn("saveBaseline failed", { error: String(err) });
  }
}

export async function POST(req: Request) {
  if (!isAuthorised(req)) {
    return NextResponse.json(
      { error: "unauthorised — set CRON_SECRET or call from Vercel Cron" },
      { status: 401 },
    );
  }

  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  const result = await runNightly(
    {
      buildRoot: () => buildDailyRoot(yesterday),
      computeEval: () =>
        computeEvalReport({ windowDays: 7, samplesPerAgent: 20 }),
      loadBaseline,
      saveBaseline,
      detectRegressions,
      sendAlert: sendCronAlert,
    },
    { regressionThresholdPct: 5 },
  );

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}

// Vercel Cron sends GET by default — alias for convenience
export const GET = POST;
