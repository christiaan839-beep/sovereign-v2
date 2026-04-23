/**
 * Server-only mutations + queries for admin review of SAM submissions.
 *
 * Every function here is gated by the caller — all routes that invoke
 * these MUST call `requireAdmin()` first. This module itself has no
 * auth logic; it just talks to the DB.
 *
 * Graceful no-DB: mutations return `null` (couldn't write) and queries
 * return `[]` / `null` (nothing to show). Admin UI renders an empty
 * state in dev without a DB.
 */

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { marketplaceAgents } from "@/db/schema";
import { createLogger } from "@/lib/logger";
import {
  agentCorpusText,
  embedAndStoreAgent,
} from "@/lib/marketplace-search";

const log = createLogger("admin-submissions");

/* ─── Types ───────────────────────────────────────────────────── */

export interface AdminSubmissionRow {
  id: string;
  slug: string | null;
  name: string;
  description: string;
  category: string;
  pricingCents: number;
  authorEmail: string;
  referenceId: string | null;
  verificationStatus: string;
  verifiedAt: Date | null;
  rejectionReason: string | null;
  submissionPolicy: string | null;
  submissionReason: string | null;
  manifestRaw: Record<string, unknown> | null;
  createdAt: Date | null;
}

export type AdminSubmissionFilter = {
  status?: "pending" | "verified" | "rejected" | "in_review" | "suspended" | "all";
  limit?: number;
};

/* ─── Internals ───────────────────────────────────────────────── */

function databaseIsConfigured(): boolean {
  return typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0;
}

function toRow(row: typeof marketplaceAgents.$inferSelect): AdminSubmissionRow {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: row.category,
    pricingCents: row.pricePerRun,
    authorEmail: row.authorEmail,
    referenceId: row.referenceId,
    verificationStatus: row.verificationStatus,
    verifiedAt: row.verifiedAt,
    rejectionReason: row.rejectionReason,
    submissionPolicy: row.submissionPolicy,
    submissionReason: row.submissionReason,
    manifestRaw:
      row.manifestRaw && typeof row.manifestRaw === "object"
        ? (row.manifestRaw as Record<string, unknown>)
        : null,
    createdAt: row.createdAt,
  };
}

/* ─── Queries ─────────────────────────────────────────────────── */

/**
 * List SAM-source submissions for the admin review UI.
 *
 * Scoped to `submission_source = 'sam-v1'` so admin tooling doesn't
 * surface dashboard-submitted agents from /api/marketplace/submit
 * (which has its own flow + its own review pattern).
 *
 * Default filter: status = "pending" (the queue), limit 50.
 */
export async function listSamSubmissions(
  filter: AdminSubmissionFilter = {},
): Promise<AdminSubmissionRow[]> {
  if (!databaseIsConfigured()) return [];

  const status = filter.status ?? "pending";
  const limit = Math.min(filter.limit ?? 50, 200);

  try {
    const baseQuery = db
      .select()
      .from(marketplaceAgents)
      .orderBy(desc(marketplaceAgents.createdAt))
      .limit(limit);

    const rows =
      status === "all"
        ? await baseQuery.where(eq(marketplaceAgents.submissionSource, "sam-v1"))
        : await baseQuery.where(
            and(
              eq(marketplaceAgents.submissionSource, "sam-v1"),
              eq(marketplaceAgents.verificationStatus, status),
            ),
          );

    return rows.map(toRow);
  } catch (err) {
    log.error("listSamSubmissions failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/** Fetch a single SAM submission by its marketplace_agents.id UUID. */
export async function getSamSubmission(
  id: string,
): Promise<AdminSubmissionRow | null> {
  if (!id || !databaseIsConfigured()) return null;
  try {
    const rows = await db
      .select()
      .from(marketplaceAgents)
      .where(
        and(
          eq(marketplaceAgents.id, id),
          eq(marketplaceAgents.submissionSource, "sam-v1"),
        ),
      )
      .limit(1);
    return rows[0] ? toRow(rows[0]) : null;
  } catch (err) {
    log.error("getSamSubmission failed", {
      id,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/* ─── Mutations ───────────────────────────────────────────────── */

export interface MutationResult {
  ok: boolean;
  /** Populated on success. */
  row?: AdminSubmissionRow;
  /** Populated on failure. Machine-readable short code. */
  error?: "not_found" | "already_terminal" | "db_unavailable" | "insert_failed";
}

/**
 * Approve a pending submission. Sets:
 *   verification_status = "verified"
 *   is_public           = true
 *   verified_at         = NOW()
 *
 * Refuses to re-approve an already-verified row (returns
 * `already_terminal`) — protects against double-approvals via double
 * click / stale UI.
 */
export async function approveSamSubmission(
  id: string,
  adminUserId: string,
): Promise<MutationResult> {
  if (!databaseIsConfigured()) return { ok: false, error: "db_unavailable" };

  const existing = await getSamSubmission(id);
  if (!existing) return { ok: false, error: "not_found" };
  if (existing.verificationStatus === "verified") {
    return { ok: false, error: "already_terminal" };
  }

  try {
    await db
      .update(marketplaceAgents)
      .set({
        verificationStatus: "verified",
        isPublic: true,
        verifiedAt: new Date(),
        rejectionReason: null,
      })
      .where(eq(marketplaceAgents.id, id));

    log.info("Admin approved SAM submission", {
      id,
      slug: existing.slug,
      adminUserId,
    });

    const fresh = await getSamSubmission(id);
    if (fresh) {
      // Fire-and-forget embedding. Failure here doesn't block approval
      // — the agent is live, it's just not yet semantic-searchable.
      // A nightly backfill can catch rows without embeddings.
      void embedAndStoreAgent({
        id: fresh.id,
        corpusText: agentCorpusText({
          name: fresh.name,
          description: fresh.description,
          category: fresh.category,
          manifestRaw: fresh.manifestRaw,
        }),
      });
    }
    return fresh ? { ok: true, row: fresh } : { ok: false, error: "insert_failed" };
  } catch (err) {
    log.error("approveSamSubmission failed", {
      id,
      adminUserId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: "insert_failed" };
  }
}

/**
 * Reject a submission with a reason (visible to the creator on any
 * future communication). Sets:
 *   verification_status = "rejected"
 *   is_public           = false
 *   rejection_reason    = reason
 *
 * A rejected row can be re-reviewed later (moved back to pending) if
 * the creator resubmits — but that's a distinct flow, not this one.
 */
export async function rejectSamSubmission(
  id: string,
  adminUserId: string,
  reason: string,
): Promise<MutationResult> {
  // Validate inputs BEFORE touching the DB. An empty reason here is a
  // programmer error — the API route should have already rejected it
  // with a 400. Throwing early signals the bug loudly.
  const trimmed = reason.trim();
  if (trimmed.length === 0) {
    throw new Error("reject: reason is required (trimmed length > 0)");
  }

  if (!databaseIsConfigured()) return { ok: false, error: "db_unavailable" };

  const existing = await getSamSubmission(id);
  if (!existing) return { ok: false, error: "not_found" };
  if (existing.verificationStatus === "rejected") {
    return { ok: false, error: "already_terminal" };
  }

  try {
    await db
      .update(marketplaceAgents)
      .set({
        verificationStatus: "rejected",
        isPublic: false,
        rejectionReason: trimmed,
      })
      .where(eq(marketplaceAgents.id, id));

    log.info("Admin rejected SAM submission", {
      id,
      slug: existing.slug,
      adminUserId,
      reasonLength: trimmed.length,
    });

    const fresh = await getSamSubmission(id);
    return fresh ? { ok: true, row: fresh } : { ok: false, error: "insert_failed" };
  } catch (err) {
    log.error("rejectSamSubmission failed", {
      id,
      adminUserId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, error: "insert_failed" };
  }
}
