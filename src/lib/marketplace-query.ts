/**
 * Server-only queries against the marketplace_agents table.
 *
 * Every function here is safe to call without a configured database —
 * returns null (for single-row queries) or an empty list (for
 * multi-row). This keeps unit tests working without DB setup and keeps
 * a Neon outage from 500'ing public pages.
 */

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { marketplaceAgents } from "@/db/schema";
import { createLogger } from "@/lib/logger";

const log = createLogger("marketplace-query");

/* ─── Types ───────────────────────────────────────────────────── */

export interface MarketplaceAgentView {
  id: string;
  slug: string | null;
  name: string;
  description: string;
  category: string;
  samCategory: string | null;
  guarantees: string[];
  pricingCents: number;
  verificationStatus: string;
  verifiedAt: Date | null;
  authorEmail: string;
  referenceId: string | null;
  submissionSource: string | null;
  manifestRaw: Record<string, unknown> | null;
  createdAt: Date | null;
}

/* ─── Internal helpers ────────────────────────────────────────── */

function databaseIsConfigured(): boolean {
  return typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0;
}

function extractGuarantees(manifestRaw: unknown): string[] {
  if (
    typeof manifestRaw !== "object" ||
    manifestRaw === null ||
    Array.isArray(manifestRaw)
  ) {
    return [];
  }
  const m = manifestRaw as Record<string, unknown>;
  if (!Array.isArray(m.guarantees)) return [];
  return m.guarantees.filter((g): g is string => typeof g === "string");
}

function extractSamCategory(manifestRaw: unknown): string | null {
  if (
    typeof manifestRaw !== "object" ||
    manifestRaw === null ||
    Array.isArray(manifestRaw)
  ) {
    return null;
  }
  const m = manifestRaw as Record<string, unknown>;
  return typeof m.category === "string" ? m.category : null;
}

function rowToView(row: typeof marketplaceAgents.$inferSelect): MarketplaceAgentView {
  const manifestRaw =
    row.manifestRaw && typeof row.manifestRaw === "object"
      ? (row.manifestRaw as Record<string, unknown>)
      : null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    category: row.category,
    samCategory: extractSamCategory(row.manifestRaw),
    guarantees: extractGuarantees(row.manifestRaw),
    pricingCents: row.pricePerRun,
    verificationStatus: row.verificationStatus,
    verifiedAt: row.verifiedAt,
    authorEmail: row.authorEmail,
    referenceId: row.referenceId,
    submissionSource: row.submissionSource,
    manifestRaw,
    createdAt: row.createdAt,
  };
}

/* ─── Public API ──────────────────────────────────────────────── */

/**
 * Look up a published, verified marketplace agent by its SAM slug.
 *
 * Returns null if:
 *   - DB isn't configured
 *   - slug is empty / null
 *   - agent exists but isn't public or not verified (intentional hide)
 *   - no matching row
 *   - query threw (error logged)
 *
 * The verification gate is important: /marketplace/{slug} is the
 * public-facing URL, so showing a pending or rejected agent here
 * would leak unreviewed content to the world.
 */
export async function fetchPublishedAgentBySlug(
  slug: string,
): Promise<MarketplaceAgentView | null> {
  if (!slug || !databaseIsConfigured()) return null;

  try {
    const rows = await db
      .select()
      .from(marketplaceAgents)
      .where(
        and(
          eq(marketplaceAgents.slug, slug),
          eq(marketplaceAgents.verificationStatus, "verified"),
          eq(marketplaceAgents.isPublic, true),
        ),
      )
      .limit(1);

    const row = rows[0];
    return row ? rowToView(row) : null;
  } catch (err) {
    log.error("fetchPublishedAgentBySlug failed", {
      slug,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * List published, verified agents — for marketplace index pages.
 * Ordered by most-recently-created first.
 */
export async function listPublishedAgents(
  limit = 50,
): Promise<MarketplaceAgentView[]> {
  if (!databaseIsConfigured()) return [];

  try {
    const rows = await db
      .select()
      .from(marketplaceAgents)
      .where(
        and(
          eq(marketplaceAgents.verificationStatus, "verified"),
          eq(marketplaceAgents.isPublic, true),
        ),
      )
      .orderBy(desc(marketplaceAgents.createdAt))
      .limit(Math.min(limit, 200));
    return rows.map(rowToView);
  } catch (err) {
    log.error("listPublishedAgents failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}
