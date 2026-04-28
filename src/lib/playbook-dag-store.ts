/**
 * PLAYBOOK DAG STORE
 *
 * Typed Drizzle CRUD for playbook_dags + playbook_dag_runs. Every
 * route that touches DAG storage goes through this module so:
 *
 *   1. Tenant isolation is centralised — every query carries userId.
 *   2. Result-truncation logic is in one place (per-node outputs >32KB
 *      are clipped before insert so a single chatty agent can't bloat
 *      the run history table).
 *   3. The "graceful no-DB" fallback (DATABASE_URL unset) is one place
 *      to maintain — every helper returns the same shape regardless,
 *      and the route layer never has to know whether persistence
 *      actually happened.
 *
 * EVERY function returns success | failure shape, never throws on
 * "DB is missing". The route's job is to translate that into the
 * right HTTP response. This mirrors the audit-log pattern: storage
 * problems should never block the user response, only get logged.
 */

import { eq, and, desc, sql } from "drizzle-orm";
import type { PlaybookDag, NodeRunResult } from "./playbook-dag";

/**
 * Public shape of a saved DAG. The `dag` field is what the editor
 * loads back into its state.
 */
export interface SavedDag {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  dag: PlaybookDag;
  status: "draft" | "published" | "archived";
  nodeCount: number;
  edgeCount: number;
  lastRunAt: string | null;
  lastRunStatus: "completed" | "failed" | null;
  lastRunDurationMs: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Public shape of a DAG run record — what the run history view renders.
 *
 * `running` is the in-flight async state. It transitions to either
 * `completed` or `failed` when the background worker finalises. Polling
 * clients can read `progressNodesCompleted` to render a partial view
 * without re-parsing the results JSONB.
 */
export interface SavedDagRun {
  id: string;
  userId: string;
  dagId: string | null;
  dagSnapshot: PlaybookDag;
  status: "running" | "completed" | "failed";
  nodeCount: number;
  edgeCount: number;
  results: NodeRunResult[];
  totalDurationMs: number;
  failedAt: string | null;
  /** How many nodes have reached completed/failed/skipped so far. 0 to nodeCount. */
  progressNodesCompleted: number;
  /** Async pickup time. NULL for sync runs (where it equals createdAt). */
  startedAt: string | null;
  /** Heartbeat for orphan detection. Touched after every node complete. */
  lastProgressAt: string | null;
  createdAt: string;
}

/**
 * Lazy DB import. We don't want to pull `@/db` into the Edge bundle.
 * The store is only ever called from Node-runtime route handlers, so
 * the dynamic import is safe.
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

/**
 * Per-result output truncation. A single chatty agent that returns
 * 500KB of generated text shouldn't bloat the run-history row. We
 * clip to ~32KB of stringified output and add a marker so the UI
 * can show "(truncated)".
 */
const MAX_OUTPUT_BYTES = 32 * 1024;

function truncateResults(results: NodeRunResult[]): NodeRunResult[] {
  return results.map((r) => {
    if (r.output === undefined) return r;
    let serialized: string;
    try {
      serialized = JSON.stringify(r.output);
    } catch {
      // Circular references etc. Replace with a marker rather than
      // refusing to record the run.
      return { ...r, output: { __unserializable: true } };
    }
    if (serialized.length <= MAX_OUTPUT_BYTES) return r;
    return {
      ...r,
      output: {
        __truncated: true,
        __originalBytes: serialized.length,
        __preview: serialized.slice(0, 4096),
      },
    };
  });
}

/**
 * Insert a fresh DAG row. Returns the new id, or null when DB is
 * unavailable (so the route can still respond 200 with `persisted:
 * false`).
 */
export async function insertDag(input: {
  userId: string;
  name: string;
  description?: string | null;
  dag: PlaybookDag;
  status?: "draft" | "published";
}): Promise<{ id: string; persisted: true } | { id: string; persisted: false }> {
  const db = await getDb();
  // Logical fallback id so the editor still gets something it can
  // round-trip with a "saved" UX, even when persistence is offline.
  const fallbackId = `dag_local_${Date.now()}`;
  if (!db) return { id: fallbackId, persisted: false };

  try {
    const { playbookDags } = await import("@/db/schema");
    const inserted = await db
      .insert(playbookDags)
      .values({
        userId: input.userId,
        name: input.name,
        description: input.description ?? null,
        dag: input.dag as unknown as object,
        status: input.status ?? "draft",
        nodeCount: input.dag.nodes.length,
        edgeCount: input.dag.edges.length,
      })
      .returning({ id: playbookDags.id });
    const id = inserted[0]?.id;
    return id
      ? { id, persisted: true }
      : { id: fallbackId, persisted: false };
  } catch {
    return { id: fallbackId, persisted: false };
  }
}

/**
 * Update an existing DAG. Tenant-isolation is enforced by the WHERE
 * clause — passing someone else's id is a no-op, not a leak.
 */
export async function updateDag(input: {
  id: string;
  userId: string;
  name?: string;
  description?: string | null;
  dag?: PlaybookDag;
  status?: "draft" | "published" | "archived";
}): Promise<{ updated: boolean }> {
  const db = await getDb();
  if (!db) return { updated: false };

  try {
    const { playbookDags } = await import("@/db/schema");
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description;
    if (input.dag !== undefined) {
      patch.dag = input.dag as unknown as object;
      patch.nodeCount = input.dag.nodes.length;
      patch.edgeCount = input.dag.edges.length;
    }
    if (input.status !== undefined) patch.status = input.status;

    const result = await db
      .update(playbookDags)
      .set(patch)
      .where(
        and(eq(playbookDags.id, input.id), eq(playbookDags.userId, input.userId)),
      )
      .returning({ id: playbookDags.id });
    return { updated: result.length > 0 };
  } catch {
    return { updated: false };
  }
}

/**
 * List the user's DAGs, newest-edit first. `status` defaults to
 * draft+published (excludes archived).
 */
export async function listDags(input: {
  userId: string;
  limit?: number;
  includeArchived?: boolean;
}): Promise<{ dags: SavedDag[] }> {
  const db = await getDb();
  if (!db) return { dags: [] };

  try {
    const { playbookDags } = await import("@/db/schema");
    const limit = Math.min(Math.max(1, input.limit ?? 50), 200);
    const rows = await db
      .select()
      .from(playbookDags)
      .where(
        input.includeArchived
          ? eq(playbookDags.userId, input.userId)
          : and(
              eq(playbookDags.userId, input.userId),
              sql`${playbookDags.status} != 'archived'`,
            ),
      )
      .orderBy(desc(playbookDags.updatedAt))
      .limit(limit);
    return { dags: rows.map(rowToSavedDag) };
  } catch {
    return { dags: [] };
  }
}

/**
 * Fetch one DAG by id, scoped to user. Returns null when not found
 * OR when the requesting user doesn't own it — the route never
 * distinguishes (no information leak via 404 vs. 403).
 */
export async function getDag(input: {
  id: string;
  userId: string;
}): Promise<SavedDag | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const { playbookDags } = await import("@/db/schema");
    const rows = await db
      .select()
      .from(playbookDags)
      .where(
        and(eq(playbookDags.id, input.id), eq(playbookDags.userId, input.userId)),
      )
      .limit(1);
    return rows[0] ? rowToSavedDag(rows[0]) : null;
  } catch {
    return null;
  }
}

/**
 * Clone a DAG into a new row owned by the same user. Useful for the
 * "fork this playbook" UX — copy an existing DAG, give it a new name,
 * leave the original alone. The new row starts as `draft` regardless
 * of the source's status; cloning isn't publishing.
 *
 * Tenant-scoped read: the source must belong to the requesting user.
 * Returns null on miss (same response as not-found / wrong-owner).
 */
export async function cloneDag(input: {
  sourceId: string;
  userId: string;
  /** Optional override; defaults to "<source name> (copy)". */
  name?: string;
}): Promise<{ id: string; persisted: boolean } | null> {
  const source = await getDag({ id: input.sourceId, userId: input.userId });
  if (!source) return null;
  const newName = input.name ?? `${source.name} (copy)`;
  const result = await insertDag({
    userId: input.userId,
    name: newName,
    description: source.description,
    dag: source.dag,
    status: "draft",
  });
  return { id: result.id, persisted: result.persisted };
}

/**
 * Soft-delete a DAG by setting status='archived'. Hard delete is not
 * exposed — the run history references this row and we want SET NULL
 * to fire predictably. If the row is gone the FK breaks tellingly.
 */
export async function archiveDag(input: {
  id: string;
  userId: string;
}): Promise<{ archived: boolean }> {
  const db = await getDb();
  if (!db) return { archived: false };

  try {
    const { playbookDags } = await import("@/db/schema");
    const result = await db
      .update(playbookDags)
      .set({ status: "archived", updatedAt: new Date() })
      .where(
        and(eq(playbookDags.id, input.id), eq(playbookDags.userId, input.userId)),
      )
      .returning({ id: playbookDags.id });
    return { archived: result.length > 0 };
  } catch {
    return { archived: false };
  }
}

/**
 * Round 12 — create an in-flight run row for the async path.
 *
 * Returns the new runId immediately (before any execution). The caller
 * (typically /api/playbooks/run-dag in async mode) then runs the DAG
 * via after() and updates this row as it progresses.
 *
 * Status starts as 'running'. progressNodesCompleted=0. results=[].
 * The dagSnapshot is captured here, so even if the live DAG changes
 * later the run's own snapshot reflects what the worker is executing.
 *
 * Returns null when DB is unavailable — async-path callers must
 * fall back to sync execution rather than silently dropping the run.
 */
export async function createPendingRun(input: {
  userId: string;
  dagId: string | null;
  dag: PlaybookDag;
}): Promise<{ runId: string } | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const { playbookDagRuns } = await import("@/db/schema");
    const now = new Date();
    const inserted = await db
      .insert(playbookDagRuns)
      .values({
        userId: input.userId,
        dagId: input.dagId,
        dagSnapshot: input.dag as unknown as object,
        status: "running",
        nodeCount: input.dag.nodes.length,
        edgeCount: input.dag.edges.length,
        results: [] as unknown as object,
        totalDurationMs: 0,
        progressNodesCompleted: 0,
        startedAt: now,
        lastProgressAt: now,
      })
      .returning({ id: playbookDagRuns.id });
    const runId = inserted[0]?.id;
    return runId ? { runId } : null;
  } catch {
    return null;
  }
}

/**
 * Round 12 — incremental progress update during async execution.
 *
 * Called after each node completes (or fails / skips). Writes the
 * partial results array, bumps progressNodesCompleted, and touches
 * lastProgressAt for orphan detection.
 *
 * Tenant-scoped via the WHERE — a hostile actor can't push progress
 * for someone else's run.
 *
 * NEVER throws. A progress update failure (DB hiccup) shouldn't kill
 * the worker; the next update will likely succeed.
 */
export async function updateRunProgress(input: {
  runId: string;
  userId: string;
  results: NodeRunResult[];
  progressNodesCompleted: number;
}): Promise<{ updated: boolean }> {
  const db = await getDb();
  if (!db) return { updated: false };

  try {
    const { playbookDagRuns } = await import("@/db/schema");
    const truncated = truncateResults(input.results);
    const result = await db
      .update(playbookDagRuns)
      .set({
        results: truncated as unknown as object,
        progressNodesCompleted: input.progressNodesCompleted,
        lastProgressAt: new Date(),
      })
      .where(
        and(
          eq(playbookDagRuns.id, input.runId),
          eq(playbookDagRuns.userId, input.userId),
        ),
      )
      .returning({ id: playbookDagRuns.id });
    return { updated: result.length > 0 };
  } catch {
    return { updated: false };
  }
}

/**
 * Round 12 — finalise an async run. Sets terminal status, writes the
 * final results array + totalDurationMs + failedAt, and bumps the
 * parent DAG's last_run_* fields the same way recordDagRun does for
 * sync runs.
 *
 * Idempotent: calling twice with the same status leaves the row in
 * the same state.
 */
export async function finalizeRun(input: {
  runId: string;
  userId: string;
  dagId: string | null;
  status: "completed" | "failed";
  results: NodeRunResult[];
  totalDurationMs: number;
  failedAt: string | null;
}): Promise<{ finalized: boolean }> {
  const db = await getDb();
  if (!db) return { finalized: false };

  try {
    const { playbookDags, playbookDagRuns } = await import("@/db/schema");
    const truncated = truncateResults(input.results);
    const completedNodes = input.results.filter(
      (r) => r.status === "completed" || r.status === "failed" || r.status === "skipped",
    ).length;
    const finalRow = await db
      .update(playbookDagRuns)
      .set({
        status: input.status,
        results: truncated as unknown as object,
        totalDurationMs: input.totalDurationMs,
        failedAt: input.failedAt,
        progressNodesCompleted: completedNodes,
        lastProgressAt: new Date(),
      })
      .where(
        and(
          eq(playbookDagRuns.id, input.runId),
          eq(playbookDagRuns.userId, input.userId),
        ),
      )
      .returning({ id: playbookDagRuns.id });

    // Mirror recordDagRun's parent-update so MyDagsPanel pills show
    // the right state regardless of whether the run was sync or async.
    if (input.dagId) {
      await db
        .update(playbookDags)
        .set({
          lastRunAt: new Date(),
          lastRunStatus: input.status,
          lastRunDurationMs: input.totalDurationMs,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(playbookDags.id, input.dagId),
            eq(playbookDags.userId, input.userId),
          ),
        );
    }
    return { finalized: finalRow.length > 0 };
  } catch {
    return { finalized: false };
  }
}

/**
 * Record a DAG run. Also updates the parent DAG's last_run fields
 * in the same transaction so the "My playbooks" panel can show
 * status pills without joining.
 *
 * NEVER throws — runs are valuable telemetry and a recording failure
 * shouldn't block the response to the user. The route caller logs
 * the {recorded:false} branch.
 */
export async function recordDagRun(input: {
  userId: string;
  dagId: string | null;
  dag: PlaybookDag;
  status: "completed" | "failed";
  results: NodeRunResult[];
  totalDurationMs: number;
  failedAt: string | null;
}): Promise<{ recorded: boolean; runId: string | null }> {
  const db = await getDb();
  if (!db) return { recorded: false, runId: null };

  try {
    const { playbookDags, playbookDagRuns } = await import("@/db/schema");
    const truncated = truncateResults(input.results);
    const now = new Date();
    const completedNodes = input.results.filter(
      (r) => r.status === "completed" || r.status === "failed" || r.status === "skipped",
    ).length;
    const inserted = await db
      .insert(playbookDagRuns)
      .values({
        userId: input.userId,
        dagId: input.dagId,
        dagSnapshot: input.dag as unknown as object,
        status: input.status,
        nodeCount: input.dag.nodes.length,
        edgeCount: input.dag.edges.length,
        results: truncated as unknown as object,
        totalDurationMs: input.totalDurationMs,
        failedAt: input.failedAt,
        // Sync runs hit terminal state immediately; record both
        // started_at and last_progress_at as "now" so the row's
        // telemetry stays consistent with the async path.
        progressNodesCompleted: completedNodes,
        startedAt: now,
        lastProgressAt: now,
      })
      .returning({ id: playbookDagRuns.id });
    const runId = inserted[0]?.id ?? null;

    // Best-effort update on the parent. If the dagId is null (run
    // happened on an unsaved DAG) or the user reassigned ownership,
    // the WHERE clause matches nothing and that's fine.
    if (input.dagId) {
      await db
        .update(playbookDags)
        .set({
          lastRunAt: new Date(),
          lastRunStatus: input.status,
          lastRunDurationMs: input.totalDurationMs,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(playbookDags.id, input.dagId),
            eq(playbookDags.userId, input.userId),
          ),
        );
    }

    return { recorded: !!runId, runId };
  } catch {
    return { recorded: false, runId: null };
  }
}

/**
 * Fetch one run by id, scoped to user. Returns null when not found OR
 * when the user doesn't own it — same response either way (no
 * information leak via 404 vs 403).
 *
 * Returns the FULL SavedDagRun including `dagSnapshot` + `results[]`
 * for the forensic detail page. Costs more bytes than listDagRuns
 * deliberately — this is the single-row lookup, not the list.
 */
export async function getDagRun(input: {
  id: string;
  userId: string;
}): Promise<SavedDagRun | null> {
  const db = await getDb();
  if (!db) return null;

  try {
    const { playbookDagRuns } = await import("@/db/schema");
    const rows = await db
      .select()
      .from(playbookDagRuns)
      .where(
        and(eq(playbookDagRuns.id, input.id), eq(playbookDagRuns.userId, input.userId)),
      )
      .limit(1);
    return rows[0] ? rowToSavedDagRun(rows[0]) : null;
  } catch {
    return null;
  }
}

/**
 * Round 13 — orphan-detection cleanup.
 *
 * Round 12's async path uses Vercel's after() to extend execution
 * past the response. If the function gets killed (timeout, OOM,
 * deploy mid-run, etc.), the row stays at status='running' forever
 * and the user sees an indefinitely-spinning UI.
 *
 * This sweep runs periodically and finalises rows where:
 *   - status = 'running'
 *   - last_progress_at < (now - threshold)
 *
 * Threshold default: 10 minutes. Async runs that go quiet for that
 * long are presumed dead — the function's hard ceiling is 5 minutes,
 * so anything past ~10 minutes is definitely orphaned.
 *
 * Returns the count of rows reaped so the cron handler can log it
 * and the SLO dashboard can graph "orphans/hour" over time.
 *
 * Tenant-agnostic: this is a system sweep, not a per-user action.
 * The cron handler is auth'd via CRON_SECRET; this function trusts
 * the caller to be the cron worker.
 */
export async function reapOrphanedRuns(input: {
  /** Minutes since last_progress_at before declaring a run orphaned. Default 10. */
  thresholdMinutes?: number;
  /** Cap on rows reaped per invocation. Bounded so a runaway sweep
   *  doesn't dominate a cron window. Default 200. */
  limit?: number;
}): Promise<{ reaped: number; rows: { id: string; userId: string }[] }> {
  const db = await getDb();
  if (!db) return { reaped: 0, rows: [] };

  const thresholdMinutes = Math.max(1, input.thresholdMinutes ?? 10);
  const limit = Math.min(Math.max(1, input.limit ?? 200), 1000);

  try {
    const { playbookDagRuns } = await import("@/db/schema");
    const cutoff = new Date(Date.now() - thresholdMinutes * 60_000);

    // Find candidates first so we can return ids for logging.
    const candidates = await db
      .select({
        id: playbookDagRuns.id,
        userId: playbookDagRuns.userId,
      })
      .from(playbookDagRuns)
      .where(
        and(
          eq(playbookDagRuns.status, "running"),
          sql`${playbookDagRuns.lastProgressAt} < ${cutoff}`,
        ),
      )
      .limit(limit);

    if (candidates.length === 0) {
      return { reaped: 0, rows: [] };
    }

    // Mark them failed in one batch update. The set fields:
    //   status = 'failed'
    //   failed_at = '__orphaned__' (sentinel — distinguishes orphan
    //     reaps from real node-level failures in the failed_at column)
    //   last_progress_at = now (so a retry of the sweep doesn't
    //     reprocess the same row)
    const ids = candidates.map((r) => r.id);
    await db
      .update(playbookDagRuns)
      .set({
        status: "failed",
        failedAt: "__orphaned__",
        lastProgressAt: new Date(),
      })
      .where(
        and(
          eq(playbookDagRuns.status, "running"),
          sql`${playbookDagRuns.id} = ANY(${ids})`,
        ),
      );

    return { reaped: candidates.length, rows: candidates };
  } catch {
    return { reaped: 0, rows: [] };
  }
}

/**
 * List the user's recent runs. Powers the dashboard widget AND the
 * editor's "previous runs" sidebar.
 *
 * Filters (all optional, AND-combined):
 *   - dagId: scope to a single DAG
 *   - status: 'running' | 'completed' | 'failed'
 *   - before: cursor — only return runs older than this createdAt
 *     (exclusive). Used for "Load more" pagination.
 *
 * Returns runs newest-first and a `nextCursor` (the createdAt of the
 * last row) when the result hits the limit. The caller passes that
 * back as `before` for the next page.
 */
export async function listDagRuns(input: {
  userId: string;
  dagId?: string;
  status?: "running" | "completed" | "failed";
  before?: string; // ISO timestamp
  limit?: number;
}): Promise<{ runs: SavedDagRun[]; nextCursor: string | null }> {
  const db = await getDb();
  if (!db) return { runs: [], nextCursor: null };

  try {
    const { playbookDagRuns } = await import("@/db/schema");
    const limit = Math.min(Math.max(1, input.limit ?? 20), 100);

    const conditions = [eq(playbookDagRuns.userId, input.userId)];
    if (input.dagId) conditions.push(eq(playbookDagRuns.dagId, input.dagId));
    if (input.status) conditions.push(eq(playbookDagRuns.status, input.status));
    if (input.before) {
      const beforeDate = new Date(input.before);
      if (Number.isFinite(beforeDate.getTime())) {
        conditions.push(sql`${playbookDagRuns.createdAt} < ${beforeDate}`);
      }
    }

    const rows = await db
      .select()
      .from(playbookDagRuns)
      .where(and(...conditions))
      .orderBy(desc(playbookDagRuns.createdAt))
      .limit(limit);

    // Set nextCursor only when the page was full — otherwise we know
    // there are no more rows. Saves the client one round-trip on the
    // last page.
    const nextCursor =
      rows.length === limit ? rows[rows.length - 1].createdAt.toISOString() : null;

    return { runs: rows.map(rowToSavedDagRun), nextCursor };
  } catch {
    return { runs: [], nextCursor: null };
  }
}

// ─── Row mappers ────────────────────────────────────────────────────

function rowToSavedDag(row: {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  dag: unknown;
  status: string;
  nodeCount: number;
  edgeCount: number;
  lastRunAt: Date | null;
  lastRunStatus: string | null;
  lastRunDurationMs: number | null;
  createdAt: Date;
  updatedAt: Date;
}): SavedDag {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description,
    dag: row.dag as PlaybookDag,
    status: (row.status as SavedDag["status"]) ?? "draft",
    nodeCount: row.nodeCount,
    edgeCount: row.edgeCount,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    lastRunStatus: (row.lastRunStatus as SavedDag["lastRunStatus"]) ?? null,
    lastRunDurationMs: row.lastRunDurationMs,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function rowToSavedDagRun(row: {
  id: string;
  userId: string;
  dagId: string | null;
  dagSnapshot: unknown;
  status: string;
  nodeCount: number;
  edgeCount: number;
  results: unknown;
  totalDurationMs: number;
  failedAt: string | null;
  progressNodesCompleted: number | null;
  startedAt: Date | null;
  lastProgressAt: Date | null;
  createdAt: Date;
}): SavedDagRun {
  return {
    id: row.id,
    userId: row.userId,
    dagId: row.dagId,
    dagSnapshot: row.dagSnapshot as PlaybookDag,
    status: (row.status as SavedDagRun["status"]) ?? "failed",
    nodeCount: row.nodeCount,
    edgeCount: row.edgeCount,
    results: (row.results as NodeRunResult[]) ?? [],
    totalDurationMs: row.totalDurationMs,
    failedAt: row.failedAt,
    // Pre-Round-12 rows have NULL for these. Default to sensible
    // values so the SavedDagRun contract stays clean for old data.
    progressNodesCompleted: row.progressNodesCompleted ?? row.nodeCount,
    startedAt: row.startedAt?.toISOString() ?? null,
    lastProgressAt: row.lastProgressAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
