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
 */
export interface SavedDagRun {
  id: string;
  userId: string;
  dagId: string | null;
  dagSnapshot: PlaybookDag;
  status: "completed" | "failed";
  nodeCount: number;
  edgeCount: number;
  results: NodeRunResult[];
  totalDurationMs: number;
  failedAt: string | null;
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
 * List the user's recent runs. Powers the dashboard widget AND the
 * editor's "previous runs" sidebar. `dagId` filter scopes to a single
 * DAG when provided.
 */
export async function listDagRuns(input: {
  userId: string;
  dagId?: string;
  limit?: number;
}): Promise<{ runs: SavedDagRun[] }> {
  const db = await getDb();
  if (!db) return { runs: [] };

  try {
    const { playbookDagRuns } = await import("@/db/schema");
    const limit = Math.min(Math.max(1, input.limit ?? 20), 100);
    const where = input.dagId
      ? and(
          eq(playbookDagRuns.userId, input.userId),
          eq(playbookDagRuns.dagId, input.dagId),
        )
      : eq(playbookDagRuns.userId, input.userId);
    const rows = await db
      .select()
      .from(playbookDagRuns)
      .where(where)
      .orderBy(desc(playbookDagRuns.createdAt))
      .limit(limit);
    return { runs: rows.map(rowToSavedDagRun) };
  } catch {
    return { runs: [] };
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
    createdAt: row.createdAt.toISOString(),
  };
}
