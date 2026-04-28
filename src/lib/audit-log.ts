import { db } from "@/db";
import { sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";
import { createHash } from "node:crypto";

const log = createLogger("audit");

export type AuditAction =
  | "user.login"
  | "user.logout"
  | "agent.execute"
  | "settings.update"
  | "api_key.create"
  | "api_key.delete"
  | "subscription.change"
  | "webhook.received"
  | "data.export"
  | "data.delete"
  | "admin.provision"
  // Admin moderation actions on the SAM v1.0 marketplace. Specific
  // verbs (rather than "admin.action") so a SOC-2 reviewer can pull
  // "all submission rejections in 2026-Q2" with a single WHERE filter.
  | "admin.submission_approve"
  | "admin.submission_reject"
  // R27 — Cost-runaway guard fires this when a tenant auto-pauses
  // on the daily spend cap. Hash-chained so disputes ("you over-charged
  // me") settle by the immutable record, not by Slack screenshots.
  | "cost.cap_hit";

interface AuditEntry {
  userId: string;
  action: AuditAction;
  resource?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Compute a row hash from the audit entry + previous row's hash.
 *
 * The hash chain means any edit to a historical row breaks the chain
 * (this row's stored row_hash no longer matches what it should be given
 * prev_hash + the row's other fields). /api/admin/audit/verify-chain
 * walks forward from the first hashed row and returns {valid, brokenAt}.
 *
 * Uses SHA-256 from node:crypto (audit-log runs server-only, never
 * bundled to the edge or client).
 */
function hashRow(args: {
  prevHash: string;
  userId: string;
  action: string;
  resource: string;
  detailsJson: string;
  createdAtIso: string;
}): string {
  const payload = [
    args.prevHash,
    args.userId,
    args.action,
    args.resource,
    args.detailsJson,
    args.createdAtIso,
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

export async function auditLog(entry: AuditEntry): Promise<void> {
  try {
    // Fetch the most recent row_hash to chain from. If the table is empty
    // or the most recent row is pre-migration (NULL hash), start a new
    // chain with "GENESIS" as the prev_hash value.
    const prevRows = await db.execute<{ row_hash: string | null }>(
      sql`SELECT row_hash FROM audit_logs ORDER BY created_at DESC LIMIT 1`,
    );
    const prevHash =
      (Array.isArray(prevRows) && prevRows[0]?.row_hash) || "GENESIS";

    const resource = entry.resource || "";
    const detailsJson = JSON.stringify(entry.details || {});
    // We compute the hash with the SAME timestamp we insert. Use the
    // client-side timestamp so the hash matches what we're about to
    // write. Postgres NOW() could drift from this by a few ms; we use
    // a fixed ISO instead.
    const createdAtIso = new Date().toISOString();

    const rowHash = hashRow({
      prevHash,
      userId: entry.userId,
      action: entry.action,
      resource,
      detailsJson,
      createdAtIso,
    });

    await db.execute(
      sql`INSERT INTO audit_logs (user_id, action, resource, details, ip_address, created_at, prev_hash, row_hash)
          VALUES (${entry.userId}, ${entry.action}, ${resource || null}, ${detailsJson}, ${entry.ipAddress || null}, ${createdAtIso}, ${prevHash}, ${rowHash})`,
    );
  } catch (err) {
    // Audit logging should never break the app. Failure here is logged
    // to application logs so the gap is visible but the user request
    // still completes. Gap = potential blind spot; not a security hole.
    log.error("Audit log write failed", err as Record<string, unknown>);
  }
}

/**
 * Verify the hash chain from the oldest hashed row forward. Returns the
 * first broken position if any, or null if the chain is intact. Used by
 * /api/admin/audit/verify-chain (admin-only) + can run as a cron check.
 *
 * Pre-migration rows (NULL row_hash) are skipped — the chain anchors at
 * the first row with a row_hash, which is the migration's intended
 * boundary.
 */
export async function verifyAuditChain(opts: { limit?: number } = {}): Promise<{
  valid: boolean;
  checked: number;
  brokenAt: string | null;
  expectedPrev: string | null;
  foundPrev: string | null;
}> {
  const limit = Math.min(10_000, Math.max(100, opts.limit ?? 5_000));
  const rows = await db.execute<{
    id: string;
    user_id: string;
    action: string;
    resource: string | null;
    details: string | null;
    created_at: string;
    prev_hash: string | null;
    row_hash: string | null;
  }>(
    sql`SELECT id, user_id, action, resource, details, created_at, prev_hash, row_hash
        FROM audit_logs
        WHERE row_hash IS NOT NULL
        ORDER BY created_at ASC
        LIMIT ${limit}`,
  );

  const list = Array.isArray(rows) ? rows : [];
  let lastHash = "GENESIS";
  let checked = 0;
  for (const r of list) {
    const resource = r.resource ?? "";
    const detailsJson = r.details ?? "{}";
    const createdAtIso = new Date(r.created_at).toISOString();
    const expected = hashRow({
      prevHash: lastHash,
      userId: r.user_id,
      action: r.action,
      resource,
      detailsJson,
      createdAtIso,
    });
    if (r.prev_hash !== lastHash || r.row_hash !== expected) {
      return {
        valid: false,
        checked,
        brokenAt: r.id,
        expectedPrev: lastHash,
        foundPrev: r.prev_hash,
      };
    }
    lastHash = r.row_hash ?? lastHash;
    checked++;
  }
  return {
    valid: true,
    checked,
    brokenAt: null,
    expectedPrev: null,
    foundPrev: null,
  };
}
