import { desc, eq, sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("execution-audit");

/**
 * EXECUTION AUDIT — Immutable log of every agent action.
 *
 * Round 26 — DURABLE. Pre-R26 the log lived as a 10K-entry ring
 * buffer in process memory. On Vercel each isolate had its own
 * copy; cold-starts emptied it; the /security page surfaced the
 * data as a forensic artifact while it was actually amnesiac.
 *
 * Now backed by `execution_audit_log` (drizzle/0041). Append-only:
 * once a row is inserted it never changes. Pairs with `audit_logs`
 * (the SHA-256 hash chain in 0033, for high-stakes settings/admin
 * events) — execution_audit_log is the high-volume mirror of every
 * agent invocation with safety-pipeline + chain-depth + APIs touched.
 *
 * The two tables together answer different questions:
 *   - audit_logs           → "did anyone tamper with the trail?"
 *                            (hash-chained, low-volume, slow writes)
 *   - execution_audit_log  → "what did agent X actually do today?"
 *                            (high-volume, fast writes, queryable)
 *
 * When Mythos-class models can chain exploits autonomously, BOTH
 * trails are the last line of defense. The hash chain catches
 * tamper; the per-agent log catches anomalies in real time.
 */

export interface AuditEntry {
  id: string;
  timestamp: number;
  tenantId: string;
  agentName: string;
  modelUsed: string;
  input: string; // Truncated to 500 chars
  output: string; // Truncated to 500 chars
  safetyResult: {
    jailbreak: "pass" | "fail";
    pii: "pass" | "fail";
    content: "pass" | "fail";
    quality: number; // 0-100
    critic: "pass" | "fail";
  };
  trustLevel: number;
  approvalRequired: boolean;
  approvalStatus: "auto" | "approved" | "denied" | "pending";
  executionTimeMs: number;
  chainDepth: number;
  externalApisAccessed: string[];
  dataExported: boolean;
}

/**
 * Lazy DB import — keeps this module out of the Edge bundle and
 * lets tests stub DATABASE_URL absence to exercise the fallback.
 */
async function getDb() {
  if (!process.env.DATABASE_URL) return null;
  try {
    const { db } = await import("@/db");
    return db;
  } catch {
    return null;
  }
}

/** Map a DB row to the public AuditEntry shape. */
function rowToEntry(row: {
  id: string;
  tenantId: string;
  agentName: string;
  modelUsed: string;
  inputTruncated: string;
  outputTruncated: string;
  safetyJailbreak: string;
  safetyPii: string;
  safetyContent: string;
  safetyQuality: number;
  safetyCritic: string;
  trustLevel: number;
  approvalRequired: boolean;
  approvalStatus: string;
  executionTimeMs: number;
  chainDepth: number;
  externalApisAccessed: unknown;
  dataExported: boolean;
  createdAt: Date;
}): AuditEntry {
  return {
    id: row.id,
    timestamp: row.createdAt.getTime(),
    tenantId: row.tenantId,
    agentName: row.agentName,
    modelUsed: row.modelUsed,
    input: row.inputTruncated,
    output: row.outputTruncated,
    safetyResult: {
      jailbreak: row.safetyJailbreak as "pass" | "fail",
      pii: row.safetyPii as "pass" | "fail",
      content: row.safetyContent as "pass" | "fail",
      quality: row.safetyQuality,
      critic: row.safetyCritic as "pass" | "fail",
    },
    trustLevel: row.trustLevel,
    approvalRequired: row.approvalRequired,
    approvalStatus: row.approvalStatus as AuditEntry["approvalStatus"],
    executionTimeMs: row.executionTimeMs,
    chainDepth: row.chainDepth,
    externalApisAccessed: (row.externalApisAccessed as string[]) ?? [],
    dataExported: row.dataExported,
  };
}

/**
 * Log an agent execution. Returns the full entry (including the
 * minted id + timestamp) on success, or null on DB unavailable.
 *
 * NEVER throws. Audit writes are valuable telemetry but they should
 * NEVER block the user response — the route's job is to translate
 * a null return into a structured log. The hash-chained audit_logs
 * is the safety net for the small set of events that MUST persist.
 *
 * Callers can fire-and-forget: `logExecution({...}).catch(()=>{})`.
 * The return is a Promise but most callers don't await it.
 */
export async function logExecution(
  entry: Omit<AuditEntry, "id" | "timestamp">,
): Promise<AuditEntry | null> {
  const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date();
  const fullEntry: AuditEntry = {
    ...entry,
    id,
    timestamp: now.getTime(),
    input: entry.input.slice(0, 500),
    output: entry.output.slice(0, 500),
  };

  // Critical-event side-channel logging happens BEFORE the DB write
  // so an outage doesn't silence the most important alerts.
  if (entry.safetyResult.jailbreak === "fail") {
    log.error(`JAILBREAK BLOCKED: agent=${entry.agentName} tenant=${entry.tenantId}`);
  }
  if (entry.safetyResult.pii === "fail") {
    log.warn(`PII DETECTED: agent=${entry.agentName} tenant=${entry.tenantId}`);
  }
  if (entry.dataExported && entry.externalApisAccessed.length > 0) {
    log.warn(
      `DATA EXPORT TO EXTERNAL API: agent=${entry.agentName} apis=${entry.externalApisAccessed.join(",")}`,
    );
  }
  if (entry.chainDepth > 5) {
    log.warn(`DEEP CHAIN: agent=${entry.agentName} depth=${entry.chainDepth}`);
  }

  const db = await getDb();
  if (!db) return null;

  try {
    const { executionAuditLog } = await import("@/db/schema");
    await db.insert(executionAuditLog).values({
      id,
      tenantId: entry.tenantId,
      agentName: entry.agentName,
      modelUsed: entry.modelUsed,
      inputTruncated: fullEntry.input,
      outputTruncated: fullEntry.output,
      safetyJailbreak: entry.safetyResult.jailbreak,
      safetyPii: entry.safetyResult.pii,
      safetyContent: entry.safetyResult.content,
      safetyQuality: entry.safetyResult.quality,
      safetyCritic: entry.safetyResult.critic,
      trustLevel: entry.trustLevel,
      approvalRequired: entry.approvalRequired,
      approvalStatus: entry.approvalStatus,
      executionTimeMs: entry.executionTimeMs,
      chainDepth: entry.chainDepth,
      externalApisAccessed: entry.externalApisAccessed,
      dataExported: entry.dataExported,
      createdAt: now,
    });
    return fullEntry;
  } catch (err) {
    log.error("Execution audit insert failed", { id, error: String(err) });
    return null;
  }
}

/**
 * Recent audit entries for a tenant (or the platform-wide slice if
 * tenantId is omitted). Newest-first, capped at `limit`.
 *
 * Returns [] when DB is unavailable. Same shape as before R26 so
 * the security command center renders consistently regardless.
 */
export async function getAuditLog(
  tenantId?: string,
  limit = 100,
): Promise<AuditEntry[]> {
  const db = await getDb();
  if (!db) return [];
  try {
    const { executionAuditLog } = await import("@/db/schema");
    const cap = Math.min(Math.max(1, limit), 1000);
    const query = db.select().from(executionAuditLog);
    const rows = await (
      tenantId
        ? query.where(eq(executionAuditLog.tenantId, tenantId))
        : query
    )
      .orderBy(desc(executionAuditLog.createdAt))
      .limit(cap);
    return rows.map(rowToEntry);
  } catch {
    return [];
  }
}

export interface AuditStats {
  total: number;
  blocked: number;
  autoApproved: number;
  manualApproved: number;
  avgExecutionMs: number;
  pipelinePassRate: number;
}

/**
 * Aggregate stats for the security command center. Computed in a
 * single query (Postgres-side conditional sums + AVG) instead of
 * pulling every row to JS.
 */
export async function getAuditStats(tenantId?: string): Promise<AuditStats> {
  const empty: AuditStats = {
    total: 0,
    blocked: 0,
    autoApproved: 0,
    manualApproved: 0,
    avgExecutionMs: 0,
    pipelinePassRate: 0,
  };

  const db = await getDb();
  if (!db) return empty;

  try {
    const { executionAuditLog } = await import("@/db/schema");
    const [agg] = await db
      .select({
        total: sql<number>`count(*)::int`,
        blocked: sql<number>`sum(case
          when ${executionAuditLog.safetyJailbreak} = 'fail'
            or ${executionAuditLog.safetyContent} = 'fail'
            or ${executionAuditLog.approvalStatus} = 'denied'
          then 1 else 0 end)::int`,
        autoApproved: sql<number>`sum(case when ${executionAuditLog.approvalStatus} = 'auto' then 1 else 0 end)::int`,
        manualApproved: sql<number>`sum(case when ${executionAuditLog.approvalStatus} = 'approved' then 1 else 0 end)::int`,
        avgMs: sql<number>`coalesce(avg(${executionAuditLog.executionTimeMs}), 0)::int`,
        passed: sql<number>`sum(case
          when ${executionAuditLog.safetyJailbreak} = 'pass'
            and ${executionAuditLog.safetyPii} = 'pass'
            and ${executionAuditLog.safetyContent} = 'pass'
            and ${executionAuditLog.safetyCritic} = 'pass'
          then 1 else 0 end)::int`,
      })
      .from(executionAuditLog)
      .where(
        tenantId
          ? eq(executionAuditLog.tenantId, tenantId)
          : sql`1 = 1`,
      );

    if (!agg || agg.total === 0) return empty;
    return {
      total: agg.total,
      blocked: agg.blocked,
      autoApproved: agg.autoApproved,
      manualApproved: agg.manualApproved,
      avgExecutionMs: agg.avgMs,
      pipelinePassRate: Math.round(((agg.passed ?? 0) / agg.total) * 1000) / 10,
    };
  } catch {
    return empty;
  }
}
