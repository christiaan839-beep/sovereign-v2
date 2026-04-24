/**
 * /api/cron/verify-audit-chain — periodic SOC-2 audit-trail integrity check.
 *
 * Schedule: every 6 hours (registered in vercel.json crons table).
 * Frequent enough that tampering is caught within a working shift,
 * infrequent enough that the verifier's full table walk doesn't become
 * a perf burden.
 *
 * What it does:
 *   - Calls verifyAuditChain() which walks all hashed rows and recomputes
 *     each row_hash from its prev_hash + payload, comparing to the stored
 *     value.
 *   - On a clean chain: returns { ok: true, valid: true, checked: N }.
 *   - On a broken chain: logs ERROR with the broken row id, returns 500
 *     so the cron monitoring (Vercel surfaces failed cron exits) lights
 *     up the on-call dashboard.
 *
 * Why a cron in addition to the admin-clickable endpoint:
 *   The admin endpoint catches tampering only when an admin remembers to
 *   look. A cron + alert closes the loop — tampering goes from "caught
 *   eventually" to "caught within hours, automatically." For SOC-2 this
 *   matters: continuous monitoring is the whole point of an audit trail.
 *
 * Auth: Bearer CRON_SECRET via verifyCron (timing-safe compare).
 *
 * Both GET and POST supported (Vercel Cron uses GET; external schedulers
 * vary).
 */

import { NextResponse } from "next/server";
import { verifyCron } from "@/lib/cron-auth";
import { verifyAuditChain } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";

const log = createLogger("cron-verify-audit-chain");

export const runtime = "nodejs";

async function handle(request: Request): Promise<Response> {
  const unauthorized = verifyCron(request);
  if (unauthorized) return unauthorized;

  try {
    // 10k row cap — well above expected chain length even at scale,
    // bounded so a runaway table doesn't time out the cron.
    const result = await verifyAuditChain({ limit: 10_000 });

    if (!result.valid) {
      // ERROR (not warn) so this surfaces in Sentry-equivalents and
      // pages on-call. The chain breaking is one of the highest-
      // severity signals a SOC-2 system can produce.
      log.error("AUDIT CHAIN BROKEN — possible tampering detected", {
        brokenAt: result.brokenAt,
        expectedPrev: result.expectedPrev,
        foundPrev: result.foundPrev,
        checked: result.checked,
      });
      return NextResponse.json(
        {
          ok: false,
          ...result, // includes `valid: false` + brokenAt + expectedPrev + foundPrev
          alert: "audit_chain_broken",
        },
        { status: 500 },
      );
    }

    log.info("audit chain verified", { checked: result.checked });
    return NextResponse.json({
      ok: true,
      ...result,
      verifiedAt: new Date().toISOString(),
    });
  } catch (err) {
    // Distinguish "verifier crashed" (transient infra issue, retry) from
    // "chain broken" (real security signal). 500 here means we don't
    // know — re-run will tell us.
    log.error("verifyAuditChain threw", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request): Promise<Response> {
  return handle(request);
}

export async function POST(request: Request): Promise<Response> {
  return handle(request);
}
