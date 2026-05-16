/**
 * SOVEREIGN MATRIX — /api/cron/audit-log-anchor (Wave 9).
 *
 * Daily Vercel cron. Computes the SHA-256 of the current audit-log
 * hash-chain head (chainDigest from Cook 179) and submits it to the
 * OpenTimestamps public calendars. Result is persisted to the
 * audit_log_anchors table for later third-party verification.
 *
 * Security: requires CRON_SECRET in the x-cron-secret header.
 *
 * Configuration: when no calendar URLs are configured, the route
 * returns ok:false but still records the chain head digest so an
 * operator can backfill anchors later.
 */
import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs, auditLogAnchors } from "@/db/schema";
import { createLogger } from "@/lib/logger";
import {
  anchorChainHead,
  digestForAnchor,
  makeOtsCalendarClient,
  DEFAULT_OTS_CALENDARS,
} from "@/lib/audit-log-anchor";
import {
  canonicalRow,
  chainAppend,
  chainDigest,
  type AuditLogRow,
  type ChainedRow,
} from "@/lib/audit-log-integrity";
import { createHash } from "crypto";

const log = createLogger("cron-audit-log-anchor");

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GENESIS = "0".repeat(64);

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = req.headers.get("x-cron-secret");
  if (!secret || supplied !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Pull the full audit log ordered by createdAt. For a one-founder shop
  // this is fast; once volume warrants, switch to incremental anchoring
  // against the last anchored chainHead.
  let rows: Array<{
    id: string;
    userId: string;
    action: string;
    resource: string | null;
    details: string | null;
    ipAddress: string | null;
    createdAt: Date | null;
  }> = [];
  try {
    rows = await db.select().from(auditLogs).orderBy(auditLogs.createdAt);
  } catch (err) {
    log.warn("audit_logs read failed — table may be missing", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        ok: false,
        reason: "audit_logs unavailable — cannot anchor",
      },
      { status: 503 },
    );
  }

  if (rows.length === 0) {
    return NextResponse.json({
      ok: false,
      reason: "empty audit log — nothing to anchor",
      rowCount: 0,
    });
  }

  // Project each DB row onto the AuditLogRow shape that audit-log-
  // integrity expects. The schema column `userId` is mapped to a stable
  // SHA-256 (`userIdHash`) — we never anchor raw user IDs into a public
  // chain. `outcome` is heuristic: rows that recorded an `*.failed` /
  // `*.denied` action are marked accordingly, everything else passes.
  function userIdHash(userId: string): string {
    return createHash("sha256").update(userId, "utf8").digest("hex");
  }
  function outcomeFromAction(action: string): string {
    if (action.endsWith(".failed")) return "error";
    if (action.endsWith(".denied")) return "denied";
    if (action.endsWith(".revoked")) return "revoked";
    return "success";
  }

  // Re-derive the chain head deterministically. canonicalRow is pure,
  // chainAppend is pure — same rows → same head.
  let prev = GENESIS;
  const chained: ChainedRow[] = rows.map((r) => {
    const row: AuditLogRow = {
      id: r.id,
      occurredAt: (r.createdAt ?? new Date()).getTime(),
      userIdHash: userIdHash(r.userId),
      action: r.action,
      resource: r.resource ?? "",
      outcome: outcomeFromAction(r.action),
      metadata: r.details ?? undefined,
    };
    canonicalRow(row); // sanity — throws on malformed
    const chainHead = chainAppend(prev, row);
    const out: ChainedRow = { ...row, prevHead: prev, chainHead };
    prev = chainHead;
    return out;
  });

  // chainDigest binds chainHead, row count, time range — anchor that.
  const digestHex = digestForAnchor(chainDigest(chained));

  // Construct calendar clients. Empty when OTS_CALENDARS is not set
  // (operator opted out) or when the env override is "none".
  const calendarUrls =
    process.env.OTS_CALENDARS === "none"
      ? []
      : (process.env.OTS_CALENDARS?.split(",")
          .map((s) => s.trim())
          .filter(Boolean) ?? Array.from(DEFAULT_OTS_CALENDARS));
  const clients = calendarUrls.map((url) => makeOtsCalendarClient(url));

  const attestation = await anchorChainHead(digestHex, clients);

  // Persist the result. Best-effort — never fail the cron because the
  // database write failed (we still issued the OTS submissions).
  try {
    await db.insert(auditLogAnchors).values({
      chainHead: digestHex,
      rowCount: chained.length,
      proofs: JSON.stringify(attestation.proofs),
      failures: JSON.stringify(attestation.failures),
      ok: attestation.ok,
      attestedAt: new Date(attestation.attestedAt),
    });
  } catch (err) {
    log.warn("audit_log_anchors insert failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  log.info("Audit-log anchor complete", {
    chainHead: digestHex,
    rowCount: chained.length,
    accepted: attestation.proofs.length,
    rejected: attestation.failures.length,
  });

  return NextResponse.json({
    ok: attestation.ok,
    chainHead: digestHex,
    rowCount: chained.length,
    proofs: attestation.proofs.map((p) => ({
      calendar: p.calendar,
      // Don't echo the full proof blob in the cron response — it's
      // already persisted, and these can be large.
      proofLengthB64: p.proof.length,
      submittedAt: p.submittedAt,
    })),
    failures: attestation.failures,
    attestedAt: attestation.attestedAt,
  });
}
