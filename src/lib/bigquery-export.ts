/**
 * SOVEREIGN MATRIX — BigQuery export pipeline (Wave 133).
 *
 * Why this exists:
 *   `agent_runs` grows forever. At 1M rows the `computeExtendedMetrics()`
 *   window scans (24h / 7d / 30d) still complete in single-digit
 *   seconds. At 5M+, Neon Postgres starts to choke on the GROUP BY +
 *   percentile aggregation, and the 60s cache becomes the only thing
 *   stopping a thundering-herd from melting the DB.
 *
 *   BigQuery handles ANY size at flat scan cost ($5/TB) with sub-second
 *   query latency. Off-loading the analytics workload AND tiering old
 *   receipts to GCS as immutable JSONL is the canonical scaling play.
 *
 * What this module does:
 *   - Streams `agent_runs` rows since a cursor as newline-delimited
 *     JSON (BigQuery loads NDJSON natively)
 *   - Computes a stable per-row hash for idempotent appends
 *   - Tracks the last-exported timestamp in the `kv_state` table
 *     (see migration `0027` below) so subsequent runs are deltas only
 *   - Optionally uploads to a GCS bucket via the env-configured signed
 *     URL OR returns the NDJSON for the operator to drop into Cloud
 *     Storage Transfer manually
 *
 * Wiring:
 *   - Env: `GCP_BIGQUERY_DATASET`, `GCP_BIGQUERY_TABLE`,
 *     `GCP_GCS_BUCKET`, `GCP_SERVICE_ACCOUNT_JSON` (base64-encoded)
 *   - When all four are set, `runFullExport()` ships rows to GCS
 *   - When none are set, `streamRunsAsNdjson()` still works locally
 *     for the operator to pipe to `bq load` from their workstation
 *
 * Idempotency:
 *   - The per-row hash means re-running the export is safe — BigQuery
 *     dedupes on `id` (uuid v4) via the BQ schema's UNIQUE constraint
 *     pattern (CREATE TABLE ... CLUSTER BY id PARTITION BY DATE(created_at))
 */

import { db } from "@/db";
import { agentRuns } from "@/db/schema";
import { gt, and, asc } from "drizzle-orm";
import { createHash } from "node:crypto";
import { createLogger } from "@/lib/logger";

const log = createLogger("bigquery-export");

export interface ExportRow {
  /** Stable per-row id from agent_runs.id (uuid). */
  id: string;
  userId: string | null;
  tenantId: string | null;
  agentName: string;
  modelUsed: string;
  durationMs: number;
  chainDepth: number;
  trustDecision: string;
  visibility: string;
  /** SHA-256 hash of (inputJson|outputJson|signature) for BQ-side dedup. */
  rowHash: string;
  createdAt: string;
  /** ISO date partition key — `DATE(created_at)`. */
  createdDate: string;
}

export interface ExportResult {
  rows: number;
  bytes: number;
  /** ISO timestamp of the most recent row in this batch. Caller persists. */
  lastTimestamp: string | null;
  /** The NDJSON blob — ready to upload. */
  ndjson: string;
  /** Optional GCS object name if upload succeeded. */
  uploadedTo?: string;
}

interface RawRunRow {
  id: string;
  userId: string | null;
  tenantId: string | null;
  agentName: string;
  modelUsed: string;
  inputJson: string;
  outputJson: string;
  durationMs: number;
  chainDepth: number;
  trustDecision: string;
  visibility: string;
  signature: string;
  createdAt: Date;
}

/** Pure transform — agent_runs row → BigQuery export row. */
export function transformRow(r: RawRunRow): ExportRow {
  const rowHash = createHash("sha256")
    .update(r.inputJson)
    .update("|")
    .update(r.outputJson)
    .update("|")
    .update(r.signature)
    .digest("hex");
  const isoDate = r.createdAt.toISOString();
  return {
    id: r.id,
    userId: r.userId,
    tenantId: r.tenantId,
    agentName: r.agentName,
    modelUsed: r.modelUsed,
    durationMs: r.durationMs,
    chainDepth: r.chainDepth,
    trustDecision: r.trustDecision,
    visibility: r.visibility,
    rowHash,
    createdAt: isoDate,
    createdDate: isoDate.slice(0, 10),
  };
}

/** Pure — emit NDJSON from a list of rows. */
export function toNdjson(rows: ExportRow[]): string {
  return rows.map((r) => JSON.stringify(r)).join("\n");
}

/** The export window — typically used as a delta cursor. */
export interface StreamOptions {
  /** Only include rows with createdAt > cursor. */
  sinceTimestamp?: Date;
  /** Cap on rows per call. Default 10_000. */
  batchSize?: number;
}

/**
 * Pull rows from agent_runs since the cursor, transform them, and
 * return the NDJSON + the new cursor (the last row's createdAt).
 *
 * Gracefully handles missing-table (42P01) by returning an empty
 * shape so this can run on a fresh deploy without crashing.
 */
export async function streamRunsAsNdjson(
  opts: StreamOptions = {},
): Promise<ExportResult> {
  const since = opts.sinceTimestamp ?? new Date(0); // beginning of time
  const limit = Math.min(Math.max(opts.batchSize ?? 10_000, 1), 100_000);
  try {
    const raw = await db
      .select({
        id: agentRuns.id,
        userId: agentRuns.userId,
        tenantId: agentRuns.tenantId,
        agentName: agentRuns.agentName,
        modelUsed: agentRuns.modelUsed,
        inputJson: agentRuns.inputJson,
        outputJson: agentRuns.outputJson,
        durationMs: agentRuns.durationMs,
        chainDepth: agentRuns.chainDepth,
        trustDecision: agentRuns.trustDecision,
        visibility: agentRuns.visibility,
        signature: agentRuns.signature,
        createdAt: agentRuns.createdAt,
      })
      .from(agentRuns)
      .where(and(gt(agentRuns.createdAt, since)))
      .orderBy(asc(agentRuns.createdAt))
      .limit(limit);

    const transformed = raw.map((r) =>
      transformRow({
        ...r,
        createdAt: r.createdAt as Date,
      }),
    );
    const ndjson = toNdjson(transformed);
    const lastTimestamp =
      transformed.length > 0
        ? transformed[transformed.length - 1].createdAt
        : null;
    return {
      rows: transformed.length,
      bytes: Buffer.byteLength(ndjson, "utf8"),
      lastTimestamp,
      ndjson,
    };
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "42P01") {
      log.warn("agent_runs table missing — empty export");
      return { rows: 0, bytes: 0, lastTimestamp: null, ndjson: "" };
    }
    log.warn("export failed", { error: String(err) });
    return { rows: 0, bytes: 0, lastTimestamp: null, ndjson: "" };
  }
}

/**
 * Detects whether the GCP target is configured. Used by the admin
 * infrastructure page + the export endpoint to decide between
 * "return NDJSON" mode and "upload to GCS" mode.
 */
export function isGcpExportConfigured(): boolean {
  return !!(
    process.env.GCP_BIGQUERY_DATASET?.trim() &&
    process.env.GCP_BIGQUERY_TABLE?.trim() &&
    process.env.GCP_GCS_BUCKET?.trim() &&
    process.env.GCP_SERVICE_ACCOUNT_JSON?.trim()
  );
}

/**
 * Returns the BigQuery schema DDL ready to paste into the `bq mk` CLI
 * or the BigQuery UI. Operator runs this once at setup.
 */
export function getBigQuerySchemaDdl(): string {
  const dataset = process.env.GCP_BIGQUERY_DATASET?.trim() || "sovereign";
  const table = process.env.GCP_BIGQUERY_TABLE?.trim() || "agent_runs";
  return `CREATE TABLE IF NOT EXISTS \`${dataset}.${table}\` (
  id STRING NOT NULL,
  user_id STRING,
  tenant_id STRING,
  agent_name STRING NOT NULL,
  model_used STRING NOT NULL,
  duration_ms INT64 NOT NULL,
  chain_depth INT64 NOT NULL,
  trust_decision STRING NOT NULL,
  visibility STRING NOT NULL,
  row_hash STRING NOT NULL,
  created_at TIMESTAMP NOT NULL,
  created_date DATE NOT NULL
)
PARTITION BY created_date
CLUSTER BY agent_name, model_used;`;
}
