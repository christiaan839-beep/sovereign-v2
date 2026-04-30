/**
 * GET /api/v1/audit/head
 *
 * Move 16. Public audit-chain head endpoint — the pinable tamper-evidence
 * anchor. Returns the SHA-256 hash of the most recent audit-log row,
 * the chain's row count, and the head's commit timestamp.
 *
 *   { rowHash, prevHash, rowN, signedAt }
 *
 * USE CASE
 *
 *   1. Auditor / customer fetches this URL, saves rowHash + rowN.
 *   2. Weeks pass. The auditor fetches the same URL again.
 *   3. The current rowHash will DIFFER (new rows have been added).
 *      That's expected.
 *   4. The auditor pulls the historical row that was at position
 *      `rowN` when they last checked. If that row's hash matches
 *      what they saved, the chain was not retroactively rewritten.
 *      If it doesn't match, the chain was tampered with.
 *
 * The endpoint reveals nothing secret — the row count + the head
 * hash are intended to be public. Verifiability across time is
 * built on the auditor saving these values, not on us promising.
 *
 * COMPOSES with /api/v1/verify/audit-chain (Move 14): the verify
 * endpoint accepts caller-provided rows and replays the chain
 * locally; the head endpoint provides the anchor.
 *
 * SECURITY
 *
 *   - No auth (every value is public)
 *   - CORS open (any verifier may probe)
 *   - 1-min cache so a bursty auditor isn't surprised by their own
 *     read-then-read seeing different rowN
 *   - On DB error or empty chain returns 200 with `chainEstablished: false`
 *     and null fields — empty chain is not a server fault
 */

import { NextResponse } from "next/server";
import { readAuditChainHead } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";

const log = createLogger("v1-audit-head");

export const runtime = "nodejs";
export const revalidate = 60;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
} as const;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  try {
    const head = await readAuditChainHead();
    if (head === null) {
      return NextResponse.json(
        {
          chainEstablished: false,
          rowHash: null,
          prevHash: null,
          rowN: 0,
          signedAt: null,
          docs: "https://sovereignmatrix.agency/docs/SOVEREIGN_TRUST_MANIFEST_SPEC.md",
        },
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=60",
            ...corsHeaders,
          },
        },
      );
    }
    log.info("served audit chain head", {
      rowN: head.rowN,
      rowHash: head.rowHash,
    });
    return NextResponse.json(
      {
        chainEstablished: true,
        ...head,
        verify: {
          replayEndpoint:
            "https://sovereignmatrix.agency/api/v1/verify/audit-chain",
          inspectorCommand: "sovereign-inspect verify-audit-chain",
          spec: "https://sovereignmatrix.agency/docs/SOVEREIGN_TRUST_MANIFEST_SPEC.md",
        },
      },
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60",
          // Mirror the head hash in a header for clients that want
          // to pin without re-parsing the body.
          "X-Audit-Chain-Head": head.rowHash,
          "X-Audit-Chain-Row-N": String(head.rowN),
          ...corsHeaders,
        },
      },
    );
  } catch (err) {
    log.error("audit head fetch failed", {
      err: (err as Error).message,
    });
    // Public endpoint — return a safe error shape, not a stack trace.
    return NextResponse.json(
      {
        chainEstablished: false,
        error: "audit_head_unavailable",
        details:
          "The audit chain head could not be read. This is non-fatal; " +
          "callers should retry or fall back to /api/v1/verify/audit-chain.",
      },
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          ...corsHeaders,
        },
      },
    );
  }
}
