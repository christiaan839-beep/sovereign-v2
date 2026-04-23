/**
 * Marketplace telemetry — view tracking for /marketplace/[slug].
 *
 * Privacy posture:
 *   - No IP address is logged or hashed
 *   - No raw user-agent
 *   - Referrer is reduced to host only (no path, no query)
 *   - Identity is an anonymous UUID the client mints in localStorage.
 *     No cookies, no server-side tracker.
 *   - Dedupe at 60s to prevent refresh-spam
 *
 * This is "minimum viable analytics" — enough to answer "how popular
 * is each agent" + "what's trending this week" without ever needing
 * a privacy-policy carve-out.
 *
 * Graceful no-DB: record returns false, counts return 0. No throws.
 */

import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { marketplaceAgents, marketplaceAgentViews } from "@/db/schema";
import { createLogger } from "@/lib/logger";

const log = createLogger("marketplace-telemetry");
const DEDUPE_WINDOW_MS = 60_000;

/* ─── Types ───────────────────────────────────────────────────── */

export interface RecordViewInput {
  agentId: string;
  slug?: string | null;
  /** Anonymous UUID from localStorage; client-minted. */
  anonymousId: string;
  /** Host only, e.g. "google.com". Never a full referrer URL. */
  referrerHost?: string | null;
}

export interface AgentViewStats {
  agentId: string;
  slug: string | null;
  name: string;
  views7d: number;
  views30d: number;
}

/* ─── Internals ───────────────────────────────────────────────── */

function databaseIsConfigured(): boolean {
  return typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0;
}

function sanitizeReferrerHost(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  // Accept already-clean hosts ("google.com"); reject anything with
  // path, query, or colons (ports). Keeps the column tight.
  const clean = raw.trim().toLowerCase();
  if (!/^[a-z0-9.-]{1,253}$/.test(clean)) return null;
  return clean;
}

function sanitizeAnonymousId(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  // UUID-like: 8-4-4-4-12 hex; allow a little slack for non-canonical
  // client implementations.
  const clean = raw.trim().toLowerCase();
  if (!/^[a-f0-9]{8,64}(-[a-f0-9]{1,16}){0,6}$/.test(clean)) return null;
  return clean;
}

/* ─── Record a view ───────────────────────────────────────────── */

/**
 * Returns:
 *   true         view was persisted
 *   false        DB unavailable, duplicate within window, or bad input
 *   (never throws)
 */
export async function recordAgentView(
  input: RecordViewInput,
): Promise<boolean> {
  if (!databaseIsConfigured()) return false;

  const anonymousId = sanitizeAnonymousId(input.anonymousId);
  if (!anonymousId) return false;

  const referrerHost = sanitizeReferrerHost(input.referrerHost);

  try {
    // Dedupe: if this (anon, agent) pair logged a view in the last 60s,
    // skip the insert. Deliberately a read-then-write rather than an
    // ON CONFLICT — we don't want a unique constraint because
    // legitimate views by the same user over time are valuable data.
    const cutoff = new Date(Date.now() - DEDUPE_WINDOW_MS);
    const recent = await db
      .select({ id: marketplaceAgentViews.id })
      .from(marketplaceAgentViews)
      .where(
        and(
          eq(marketplaceAgentViews.anonymousId, anonymousId),
          eq(marketplaceAgentViews.agentId, input.agentId),
          gte(marketplaceAgentViews.createdAt, cutoff),
        ),
      )
      .limit(1);

    if (recent.length > 0) return false;

    await db.insert(marketplaceAgentViews).values({
      agentId: input.agentId,
      slug: input.slug ?? null,
      anonymousId,
      referrerHost,
    });
    return true;
  } catch (err) {
    log.error("recordAgentView failed", {
      agentId: input.agentId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/* ─── Queries ─────────────────────────────────────────────────── */

/**
 * Trending agents — top N by views in the last `sinceDays` days.
 * Joins marketplace_agents for name/slug so the caller gets one
 * round-trip per request.
 */
export async function listTrendingAgents(
  options: { limit?: number; sinceDays?: number } = {},
): Promise<AgentViewStats[]> {
  if (!databaseIsConfigured()) return [];

  const limit = Math.min(options.limit ?? 10, 100);
  const sinceDays = Math.min(options.sinceDays ?? 7, 90);
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  try {
    const rows = await db
      .select({
        agentId: marketplaceAgents.id,
        slug: marketplaceAgents.slug,
        name: marketplaceAgents.name,
        views: count(marketplaceAgentViews.id),
      })
      .from(marketplaceAgents)
      .leftJoin(
        marketplaceAgentViews,
        and(
          eq(marketplaceAgentViews.agentId, marketplaceAgents.id),
          gte(marketplaceAgentViews.createdAt, since),
        ),
      )
      .where(eq(marketplaceAgents.verificationStatus, "verified"))
      .groupBy(marketplaceAgents.id, marketplaceAgents.slug, marketplaceAgents.name)
      .orderBy(desc(count(marketplaceAgentViews.id)))
      .limit(limit);

    return rows.map((r) => ({
      agentId: r.agentId,
      slug: r.slug,
      name: r.name,
      views7d: Number(r.views),
      views30d: 0, // fill-in pattern: separate query per window if needed
    }));
  } catch (err) {
    log.error("listTrendingAgents failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Per-agent view counts for a creator's own agent. Used by the
 * /dashboard/earnings page to show "views this month".
 */
export async function viewsForAgent(
  agentId: string,
  sinceDays = 30,
): Promise<number> {
  if (!databaseIsConfigured() || !agentId) return 0;
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  try {
    const rows = await db
      .select({ n: count() })
      .from(marketplaceAgentViews)
      .where(
        and(
          eq(marketplaceAgentViews.agentId, agentId),
          gte(marketplaceAgentViews.createdAt, since),
        ),
      );
    return Number(rows[0]?.n ?? 0);
  } catch (err) {
    log.error("viewsForAgent failed", {
      agentId,
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}

/** Exposed so tests can assert the same constant. */
export const DEDUPE_WINDOW_MS_EXPORT = DEDUPE_WINDOW_MS;
// Keep `sql` reachable for future rollup queries without unused-import lint.
void sql;
