/**
 * Agent bundles — curated sets of marketplace agents published as
 * one purchasable unit.
 *
 * Why this exists: when a buyer wants to automate a workflow (say,
 * "real estate listing ops"), they need ~6 agents. Paying per-agent
 * is friction. Bundles let creators (or the platform) package agents
 * into workflow solutions at a single price.
 *
 * Data model (migration 0030):
 *   agent_bundles           one row per bundle
 *   agent_bundle_memberships  N rows linking agent → bundle, with
 *                             a share_pct per member (sum = 100)
 *
 * Split math:
 *   On a bundle invocation at price_cents:
 *     platform share  = price_cents * (100 - creator_share_pct) / 100
 *     creator pool    = price_cents * creator_share_pct / 100
 *     each member     = creator pool * member.share_pct / 100
 *
 * Graceful no-DB: every function returns safe defaults — empty
 * lists, null lookups. Tests can exercise shape + math without
 * a Neon connection.
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  agentBundles,
  agentBundleMemberships,
  marketplaceAgents,
} from "@/db/schema";
import { createLogger } from "@/lib/logger";

const log = createLogger("agent-bundles");

/* ─── Types ───────────────────────────────────────────────────── */

export interface BundleMember {
  agentId: string;
  agentSlug: string;
  agentName: string;
  sharePct: number;
  position: number;
  /** Snapshot of the agent's own price — informational, not used in bundle pricing. */
  agentPriceCents: number;
}

export interface Bundle {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  publisherEmail: string;
  priceCents: number;
  creatorSharePct: number;
  isPublic: boolean;
  publishedAt: Date | null;
  members: BundleMember[];
}

export interface BundleSplit {
  platformCents: number;
  creatorPoolCents: number;
  perMember: Array<{
    agentId: string;
    agentSlug: string;
    creatorCents: number;
  }>;
}

export interface CreateBundleInput {
  slug: string;
  name: string;
  description: string;
  category: string;
  publisherEmail: string;
  priceCents: number;
  creatorSharePct?: number;
  members: Array<{
    agentSlug: string;
    sharePct: number;
  }>;
}

/* ─── Split math (pure, deterministic) ────────────────────────── */

/**
 * Compute the per-member split for a bundle invocation.
 *
 * Rounding: we floor the platform share and each member share, then
 * the creator pool gets any remainder. Same "floor-favours-creator"
 * rule we used for single-agent earnings — bundle creators never
 * see a missing penny from rounding.
 *
 * Validation: if member shares don't sum to exactly 100, we
 * proportionally re-normalise rather than reject. A bundle with
 * shares [30, 30, 35] (=95) gets scaled to ≈[32, 32, 37]. This
 * prevents a single bad edit from locking a bundle; admin tools
 * should still prevent non-100 sums at write time.
 */
export function splitBundleEarnings(args: {
  priceCents: number;
  creatorSharePct: number;
  members: Array<{ agentId: string; agentSlug: string; sharePct: number }>;
}): BundleSplit {
  const price = Math.max(0, Math.floor(args.priceCents || 0));
  const creatorPct = Math.max(0, Math.min(100, args.creatorSharePct));
  const platformCents = Math.floor(price * (100 - creatorPct) / 100);
  const creatorPoolCents = price - platformCents;

  if (!args.members.length || creatorPoolCents === 0) {
    return { platformCents, creatorPoolCents, perMember: [] };
  }

  // Proportional re-normalisation.
  const declared = args.members.reduce((n, m) => n + Math.max(0, m.sharePct), 0);
  const effectiveTotal = declared > 0 ? declared : args.members.length;

  const perMember = args.members.map((m) => {
    const effectiveShare = declared > 0 ? Math.max(0, m.sharePct) : 100 / args.members.length;
    const creatorCents = Math.floor(creatorPoolCents * effectiveShare / effectiveTotal);
    return {
      agentId: m.agentId,
      agentSlug: m.agentSlug,
      creatorCents,
    };
  });

  // Any rounding remainder flows to the first member (the one
  // with the largest share by position). Never to the platform.
  const distributed = perMember.reduce((n, m) => n + m.creatorCents, 0);
  const remainder = creatorPoolCents - distributed;
  if (remainder > 0 && perMember.length > 0) {
    perMember[0].creatorCents += remainder;
  }

  return { platformCents, creatorPoolCents, perMember };
}

/* ─── DB helpers ──────────────────────────────────────────────── */

function databaseIsConfigured(): boolean {
  return typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0;
}

/**
 * Fetch a bundle with its members fully resolved (including each
 * member agent's current name + slug + price). One JOIN; no N+1.
 *
 * Returns null if the bundle doesn't exist OR isn't public (unless
 * `opts.includePrivate` is true — intended for creator-dashboard use).
 */
export async function getBundleBySlug(
  slug: string,
  opts: { includePrivate?: boolean } = {},
): Promise<Bundle | null> {
  if (!databaseIsConfigured() || !slug) return null;

  try {
    const bundleRows = await db
      .select()
      .from(agentBundles)
      .where(eq(agentBundles.slug, slug))
      .limit(1);
    const b = bundleRows[0];
    if (!b) return null;
    if (!opts.includePrivate && !b.isPublic) return null;

    const memberRows = await db
      .select({
        agentId: agentBundleMemberships.agentId,
        agentSlug: agentBundleMemberships.agentSlug,
        sharePct: agentBundleMemberships.sharePct,
        position: agentBundleMemberships.position,
        agentName: marketplaceAgents.name,
        agentPriceCents: marketplaceAgents.pricePerRun,
      })
      .from(agentBundleMemberships)
      .leftJoin(
        marketplaceAgents,
        eq(marketplaceAgents.id, agentBundleMemberships.agentId),
      )
      .where(eq(agentBundleMemberships.bundleId, b.id))
      .orderBy(agentBundleMemberships.position);

    return {
      id: b.id,
      slug: b.slug,
      name: b.name,
      description: b.description,
      category: b.category,
      publisherEmail: b.publisherEmail,
      priceCents: b.priceCents,
      creatorSharePct: b.creatorSharePct,
      isPublic: b.isPublic,
      publishedAt: b.publishedAt,
      members: memberRows.map((m) => ({
        agentId: m.agentId,
        agentSlug: m.agentSlug,
        agentName: m.agentName ?? m.agentSlug,
        sharePct: m.sharePct,
        position: m.position,
        agentPriceCents: m.agentPriceCents ?? 0,
      })),
    };
  } catch (err) {
    log.error("getBundleBySlug failed", {
      slug,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** List public bundles for the /marketplace/bundles index. */
export async function listPublicBundles(
  opts: { category?: string; limit?: number } = {},
): Promise<Bundle[]> {
  if (!databaseIsConfigured()) return [];
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);

  try {
    const query = opts.category
      ? db
          .select()
          .from(agentBundles)
          .where(
            and(
              eq(agentBundles.isPublic, true),
              eq(agentBundles.category, opts.category),
            ),
          )
          .limit(limit)
      : db
          .select()
          .from(agentBundles)
          .where(eq(agentBundles.isPublic, true))
          .limit(limit);

    const rows = await query;
    if (!rows.length) return [];

    // Batch-fetch all memberships + agent names in two queries, not N.
    const bundleIds = rows.map((b) => b.id);
    const memberRows = await db
      .select({
        bundleId: agentBundleMemberships.bundleId,
        agentId: agentBundleMemberships.agentId,
        agentSlug: agentBundleMemberships.agentSlug,
        sharePct: agentBundleMemberships.sharePct,
        position: agentBundleMemberships.position,
        agentName: marketplaceAgents.name,
        agentPriceCents: marketplaceAgents.pricePerRun,
      })
      .from(agentBundleMemberships)
      .leftJoin(
        marketplaceAgents,
        eq(marketplaceAgents.id, agentBundleMemberships.agentId),
      )
      .where(inArray(agentBundleMemberships.bundleId, bundleIds))
      .orderBy(agentBundleMemberships.position);

    const membersByBundle = new Map<string, BundleMember[]>();
    for (const m of memberRows) {
      const list = membersByBundle.get(m.bundleId) ?? [];
      list.push({
        agentId: m.agentId,
        agentSlug: m.agentSlug,
        agentName: m.agentName ?? m.agentSlug,
        sharePct: m.sharePct,
        position: m.position,
        agentPriceCents: m.agentPriceCents ?? 0,
      });
      membersByBundle.set(m.bundleId, list);
    }

    return rows.map((b) => ({
      id: b.id,
      slug: b.slug,
      name: b.name,
      description: b.description,
      category: b.category,
      publisherEmail: b.publisherEmail,
      priceCents: b.priceCents,
      creatorSharePct: b.creatorSharePct,
      isPublic: b.isPublic,
      publishedAt: b.publishedAt,
      members: membersByBundle.get(b.id) ?? [],
    }));
  } catch (err) {
    log.error("listPublicBundles failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Create a new bundle. Validates shares sum to 100, resolves
 * each agent slug to an id, refuses unknown/unverified agent slugs.
 *
 * Returns { ok: true, id } on success; otherwise an error code
 * the caller can surface to the UI.
 */
export interface CreateBundleResult {
  ok: boolean;
  id?: string;
  code?:
    | "no_db"
    | "shares_must_sum_to_100"
    | "agent_not_found"
    | "agent_not_verified"
    | "slug_taken"
    | "insert_failed";
  missingSlugs?: string[];
}

export async function createBundle(
  input: CreateBundleInput,
): Promise<CreateBundleResult> {
  if (!databaseIsConfigured()) return { ok: false, code: "no_db" };

  // Validate shares.
  const totalShare = input.members.reduce((n, m) => n + Math.max(0, m.sharePct), 0);
  if (totalShare !== 100) {
    return { ok: false, code: "shares_must_sum_to_100" };
  }

  try {
    // Resolve all slugs → ids + check verification.
    const slugs = input.members.map((m) => m.agentSlug.toLowerCase());
    const agentRows = await db
      .select({
        id: marketplaceAgents.id,
        slug: marketplaceAgents.slug,
        verificationStatus: marketplaceAgents.verificationStatus,
      })
      .from(marketplaceAgents)
      .where(inArray(marketplaceAgents.slug, slugs));

    const found = new Map(agentRows.map((r) => [r.slug, r]));
    const missing: string[] = [];
    for (const s of slugs) {
      if (!found.has(s)) missing.push(s);
    }
    if (missing.length > 0) {
      return { ok: false, code: "agent_not_found", missingSlugs: missing };
    }

    for (const r of agentRows) {
      if (r.verificationStatus !== "verified") {
        return { ok: false, code: "agent_not_verified", missingSlugs: [r.slug ?? ""] };
      }
    }

    // Check slug uniqueness.
    const existing = await db
      .select({ id: agentBundles.id })
      .from(agentBundles)
      .where(eq(agentBundles.slug, input.slug))
      .limit(1);
    if (existing.length > 0) return { ok: false, code: "slug_taken" };

    // Insert bundle.
    const [inserted] = await db
      .insert(agentBundles)
      .values({
        slug: input.slug,
        name: input.name,
        description: input.description,
        category: input.category,
        publisherEmail: input.publisherEmail.toLowerCase(),
        priceCents: Math.max(0, Math.floor(input.priceCents)),
        creatorSharePct: Math.max(0, Math.min(100, input.creatorSharePct ?? 70)),
        isPublic: false,
      })
      .returning({ id: agentBundles.id });

    if (!inserted?.id) return { ok: false, code: "insert_failed" };

    // Insert memberships.
    const memberInserts = input.members.map((m, idx) => {
      const agent = found.get(m.agentSlug.toLowerCase());
      return {
        bundleId: inserted.id,
        agentId: agent?.id ?? "",
        agentSlug: m.agentSlug.toLowerCase(),
        sharePct: m.sharePct,
        position: idx,
      };
    });
    await db.insert(agentBundleMemberships).values(memberInserts);

    return { ok: true, id: inserted.id };
  } catch (err) {
    log.error("createBundle failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, code: "insert_failed" };
  }
}

/** Sum of the contained agents' individual prices (informational). */
export function sumOfComponentPrices(bundle: Bundle): number {
  return bundle.members.reduce((n, m) => n + m.agentPriceCents, 0);
}

/** % discount of the bundle price vs sum-of-components. */
export function bundleDiscountPct(bundle: Bundle): number {
  const sum = sumOfComponentPrices(bundle);
  if (sum <= 0) return 0;
  if (bundle.priceCents >= sum) return 0;
  return Math.round((1 - bundle.priceCents / sum) * 100);
}

/** Sync update of the `updatedAt` stamp. Fire-and-forget-safe. */
export async function touchBundle(id: string): Promise<void> {
  if (!databaseIsConfigured() || !id) return;
  try {
    await db
      .update(agentBundles)
      .set({ updatedAt: sql`NOW()` })
      .where(eq(agentBundles.id, id));
  } catch {
    /* cosmetic */
  }
}
