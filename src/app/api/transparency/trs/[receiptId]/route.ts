/**
 * GET /api/transparency/trs/:receiptId
 *
 * Returns the threshold (m-of-n) attestation for a given agent-run
 * receipt id. Public + open-CORS — anyone with a receipt id can
 * independently verify the threshold signatures.
 *
 * Returns 404 when:
 *   - the receipt id doesn't exist in audit_logs as a trs.attestation row
 *   - the threshold subsystem was disabled when the receipt was recorded
 *     (no TRS row was persisted — the v2 receipt still verifies on its own)
 *
 * Cache: 5 min. The attestation is immutable once persisted; cache busts
 * cleanly when a fresh receipt id is requested.
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

const log = createLogger("trs-fetch");

export const revalidate = 300;

// Per-IP limiter — mirrors the sibling /api/transparency/witness route
// (Medium finding, wave-95 security review). audit_logs lookup without
// an index on (action, resource) can be scan-shaped; the limiter caps
// unauthenticated enumeration cost.
const limiter = rateLimit({ interval: 60, limit: 20 });

const NOT_FOUND = (msg: string) =>
  NextResponse.json(
    { error: msg },
    {
      status: 404,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60, s-maxage=60",
      },
    },
  );

export async function GET(
  req: Request,
  ctx: { params: Promise<{ receiptId: string }> },
) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const { receiptId } = await ctx.params;
  // Basic shape guard — receiptId is a UUID v4 from crypto.randomUUID.
  if (
    typeof receiptId !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      receiptId,
    )
  ) {
    return NOT_FOUND("invalid receiptId");
  }

  let row: { details: string | null; createdAt: Date | null } | undefined;
  try {
    const rows = await db
      .select({
        details: auditLogs.details,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.action, "trs.attestation"),
          eq(auditLogs.resource, `agent_run:${receiptId}`),
        ),
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(1);
    row = rows[0];
  } catch (err) {
    // audit_logs may not exist on a fresh deploy — return 404 (not 500)
    // so consumers can treat it uniformly with "no TRS for this id".
    // Generic message (not "table missing") so an unauthenticated probe
    // can't fingerprint the deploy state. Operator sees the real error
    // in logs.
    log.warn("audit_logs read failed for TRS lookup", {
      receiptId,
      error: String(err),
    });
    return NOT_FOUND("no TRS attestation for this receipt");
  }

  if (!row) {
    return NOT_FOUND("no TRS attestation for this receipt");
  }

  let parsed: Record<string, unknown> | null = null;
  try {
    parsed = JSON.parse(row.details ?? "{}") as Record<string, unknown>;
  } catch {
    return NOT_FOUND("attestation row is malformed");
  }

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      receiptId,
      persistedAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
      schema: parsed.schema ?? "trs1",
      canonicalHash: parsed.canonicalHash ?? null,
      attestation: parsed.attestation ?? null,
      quorumMet: parsed.quorumMet ?? false,
      localContributions: parsed.localContributions ?? [],
      verifierEndpoint: "/api/transparency/threshold-status",
      notes:
        "Verify by fetching the v2 receipt from /api/agent-runs/" +
        receiptId +
        " and confirming its canonical bytes hash to canonicalHash above. " +
        "Then verify each cosigner signature in `attestation.cosigners` " +
        "against the issuer pubkeys at /.well-known/sovereign-receipts/issuers/.",
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=300, s-maxage=300",
        "Content-Type": "application/json; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
