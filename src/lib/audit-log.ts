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
  | "cost.cap_hit"
  // R30 — Agentic Commerce. Every spend authorization grant, agent
  // charge, and reversal is appended to the chain. Settles disputes
  // ("the agent bought this without my approval") by the receipt.
  | "commerce.authorize"
  | "commerce.charge"
  | "commerce.reverse"
  | "commerce.revoke"
  // R100 Policy Gate (Move 2). Fired when an agent execution is
  // blocked by a declared policy. Procurement / SOC 2 / EU AI Act
  // auditors filter on this action to see proof of policy enforcement.
  | "agent.policy_gate.deny"
  // R140 Behavioral Invariant Layer (IML). Fired when an agent's
  // observed behavior diverges from its admission-time profile A₀
  // beyond a tunable threshold (KL divergence / segment-vs-rest
  // z-test / sequential pattern-match). The IML operates ABOVE the
  // policy gate so it can catch drift earned through individually-
  // legitimate actions. EU AI Act Art. 3(23) auditors filter on
  // this to see substantial-modification proof.
  // VOCABULARY-ONLY today; the firing module ships in Move 5.
  | "agent.drift_detected"
  // R141 Viability Index (RiskGate). Fired when VI(t) ∈ [-1, +1]
  // crosses a configured warning or block threshold. Continuous
  // trustworthiness score; predictive (drops BEFORE violation),
  // not reactive. Pairs with agent.drift_detected so reviewers see
  // both the divergence and its impact on the score.
  // VOCABULARY-ONLY today; the firing module ships in Move 5.
  | "agent.viability_threshold"
  // R142 Pre-Action Governance Reasoning Loop (PAGRL). Fired when
  // an agent consults its declared governance ruleset (global /
  // workflow / agent / situational) before a state-changing action.
  // Records WHICH ruleset matched and WHAT decision was returned
  // (permitted / modified / escalated).
  // VOCABULARY-ONLY today; the firing module ships in Move 6.
  | "agent.governance_consult"
  // R143 Infrastructure Kill Switch. Fired when the kernel-level
  // (eBPF) kill switch terminates an agent's execution sandbox,
  // revokes credentials, and snapshots working state. Written
  // BEFORE credential revocation completes so the chain captures
  // the trigger even if the agent's last action was the trigger.
  // VOCABULARY-ONLY today; the firing module ships in Move 7.
  | "agent.kill_switch"
  // R144 Cross-Protocol Privilege Block. Fired when the gateway
  // refuses an A2A→MCP scope-elevation attempt. Distinct from
  // agent.policy_gate.deny because the refusal is structural
  // (protocol-level), not policy-driven.
  // VOCABULARY-ONLY today; the firing module ships in Move 8.
  | "agent.cross_protocol_block"
  // R145 Memory Payload Block. Fired when a memory write is refused
  // because the payload contains an embedded instruction pattern
  // (zombie-memory / cross-agent contagion vector). The blocked
  // payload's content hash is recorded so SOC reviewers can
  // correlate refused writes across agents.
  // FIRING MODULE: src/lib/memory/payload-guard.ts (Move 7).
  | "agent.memory_payload_blocked"
  // R150 Agentic Bill of Materials. Fired when an AIBOM is generated
  // for a deployment scope (platform-wide, tenant, or release).
  // Records the document hash + component count so SOC reviewers
  // can attest to which model/tool/dependency snapshot was active
  // at the moment of generation. OWASP ASI04 (Agentic Supply Chain
  // Vulnerabilities) — closes the supply-chain attestation gap.
  // FIRING MODULE: src/lib/supply-chain/aibom.ts (Move 8).
  | "agent.sbom_generated";

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
 * Audit-log row shape for offline chain verification. Camel-case
 * because this is the pure-function entry point — DB-side verifyAuditChain
 * maps snake-case DB columns into this shape before calling.
 *
 * Public so the /api/v1/verify/audit-chain endpoint can accept
 * caller-provided rows in the request body.
 */
export interface AuditChainRow {
  id: string;
  userId: string;
  action: string;
  resource: string | null;
  detailsJson: string | null;
  createdAt: string | Date;
  prevHash: string | null;
  rowHash: string | null;
}

/**
 * Pure: verify a hash chain over a row array. Returns the first
 * broken position if any, or null if the chain is intact.
 *
 * Reused by:
 *   - DB-bound verifyAuditChain (cron + admin endpoint)
 *   - /api/v1/verify/audit-chain public verifier endpoint
 *   - tests + the inspector port mirror
 *
 * Pre-migration rows (rowHash null) are skipped — the chain anchors
 * at the first row with a non-null rowHash, matching the migration's
 * intended boundary.
 */
export function verifyAuditChainRows(rows: AuditChainRow[]): {
  valid: boolean;
  checked: number;
  brokenAt: string | null;
  expectedPrev: string | null;
  foundPrev: string | null;
} {
  let lastHash = "GENESIS";
  let checked = 0;
  for (const r of rows) {
    if (r.rowHash === null) continue; // skip pre-migration anchor row
    const resource = r.resource ?? "";
    const detailsJson = r.detailsJson ?? "{}";
    const createdAtIso = new Date(r.createdAt).toISOString();
    const expected = hashRow({
      prevHash: lastHash,
      userId: r.userId,
      action: r.action,
      resource,
      detailsJson,
      createdAtIso,
    });
    if (r.prevHash !== lastHash || r.rowHash !== expected) {
      return {
        valid: false,
        checked,
        brokenAt: r.id,
        expectedPrev: lastHash,
        foundPrev: r.prevHash,
      };
    }
    lastHash = r.rowHash;
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

/**
 * Verify the hash chain from the oldest hashed row forward. Returns the
 * first broken position if any, or null if the chain is intact. Used by
 * /api/admin/audit/verify-chain (admin-only) + can run as a cron check.
 *
 * Pre-migration rows (NULL row_hash) are skipped — the chain anchors at
 * the first row with a row_hash, which is the migration's intended
 * boundary.
 *
 * Now thin: fetches rows from DB and delegates to verifyAuditChainRows.
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
  return verifyAuditChainRows(
    list.map((r) => ({
      id: r.id,
      userId: r.user_id,
      action: r.action,
      resource: r.resource,
      detailsJson: r.details,
      createdAt: r.created_at,
      prevHash: r.prev_hash,
      rowHash: r.row_hash,
    })),
  );
}
