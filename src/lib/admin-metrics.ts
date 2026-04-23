/**
 * Admin observability queries — dashboard aggregates for
 * /admin/metrics.
 *
 * All queries run in one round-trip via parallel Promise.all so
 * the dashboard paints fast. Every function is safe-by-default:
 * returns zeros / empty arrays when DATABASE_URL is missing.
 */

import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  creatorEarnings,
  marketplaceAgentViews,
  marketplaceAgents,
} from "@/db/schema";
import { createLogger } from "@/lib/logger";

const log = createLogger("admin-metrics");

/* ─── Types ───────────────────────────────────────────────────── */

export interface SubmissionFunnel {
  last24h: number;
  last7d: number;
  last30d: number;
  pending: number;
  verified: number;
  rejected: number;
  total: number;
}

export interface PolicyBreakdown {
  policy: string;
  count: number;
}

export interface TopAgent {
  id: string;
  slug: string | null;
  name: string;
  totalRunCount: number;
  creatorRevenueCents: number;
  views7d: number;
}

export interface EarningsAggregate {
  lifetimeGrossCents: number;
  lifetimePendingCents: number;
  lifetimePaidCents: number;
  last30dGrossCents: number;
  uniqueCreators: number;
}

export interface AdminMetrics {
  submissions: SubmissionFunnel;
  policies: PolicyBreakdown[];
  topAgents: TopAgent[];
  earnings: EarningsAggregate;
  generatedAt: string;
}

/* ─── Utilities ───────────────────────────────────────────────── */

function databaseIsConfigured(): boolean {
  return typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0;
}

function since(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

const EMPTY_FUNNEL: SubmissionFunnel = {
  last24h: 0,
  last7d: 0,
  last30d: 0,
  pending: 0,
  verified: 0,
  rejected: 0,
  total: 0,
};

const EMPTY_EARNINGS: EarningsAggregate = {
  lifetimeGrossCents: 0,
  lifetimePendingCents: 0,
  lifetimePaidCents: 0,
  last30dGrossCents: 0,
  uniqueCreators: 0,
};

/* ─── Submission funnel ───────────────────────────────────────── */

async function submissionFunnel(): Promise<SubmissionFunnel> {
  if (!databaseIsConfigured()) return EMPTY_FUNNEL;
  const d1 = since(1);
  const d7 = since(7);
  const d30 = since(30);

  try {
    const rows = await db
      .select({
        last24h: sql<number>`COUNT(*) FILTER (WHERE ${marketplaceAgents.createdAt} >= ${d1})::int`,
        last7d: sql<number>`COUNT(*) FILTER (WHERE ${marketplaceAgents.createdAt} >= ${d7})::int`,
        last30d: sql<number>`COUNT(*) FILTER (WHERE ${marketplaceAgents.createdAt} >= ${d30})::int`,
        pending: sql<number>`COUNT(*) FILTER (WHERE ${marketplaceAgents.verificationStatus} = 'pending')::int`,
        verified: sql<number>`COUNT(*) FILTER (WHERE ${marketplaceAgents.verificationStatus} = 'verified')::int`,
        rejected: sql<number>`COUNT(*) FILTER (WHERE ${marketplaceAgents.verificationStatus} = 'rejected')::int`,
        total: sql<number>`COUNT(*)::int`,
      })
      .from(marketplaceAgents)
      .where(eq(marketplaceAgents.submissionSource, "sam-v1"));

    const r = rows[0];
    if (!r) return EMPTY_FUNNEL;
    return {
      last24h: Number(r.last24h),
      last7d: Number(r.last7d),
      last30d: Number(r.last30d),
      pending: Number(r.pending),
      verified: Number(r.verified),
      rejected: Number(r.rejected),
      total: Number(r.total),
    };
  } catch (err) {
    log.error("submissionFunnel failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return EMPTY_FUNNEL;
  }
}

/* ─── Policy breakdown ────────────────────────────────────────── */

async function policyBreakdown(): Promise<PolicyBreakdown[]> {
  if (!databaseIsConfigured()) return [];
  try {
    const rows = await db
      .select({
        policy: marketplaceAgents.submissionPolicy,
        count: count(),
      })
      .from(marketplaceAgents)
      .where(eq(marketplaceAgents.submissionSource, "sam-v1"))
      .groupBy(marketplaceAgents.submissionPolicy);
    return rows.map((r) => ({
      policy: r.policy ?? "(unspecified)",
      count: Number(r.count),
    }));
  } catch (err) {
    log.error("policyBreakdown failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/* ─── Top agents by runs + views ──────────────────────────────── */

async function topAgents(limit = 10): Promise<TopAgent[]> {
  if (!databaseIsConfigured()) return [];
  const d7 = since(7);
  try {
    const rows = await db
      .select({
        id: marketplaceAgents.id,
        slug: marketplaceAgents.slug,
        name: marketplaceAgents.name,
        totalRunCount: marketplaceAgents.totalRunCount,
        creatorRevenueCents: marketplaceAgents.creatorRevenueCents,
        views7d: sql<number>`COUNT(${marketplaceAgentViews.id}) FILTER (WHERE ${marketplaceAgentViews.createdAt} >= ${d7})::int`,
      })
      .from(marketplaceAgents)
      .leftJoin(
        marketplaceAgentViews,
        eq(marketplaceAgentViews.agentId, marketplaceAgents.id),
      )
      .where(
        and(
          eq(marketplaceAgents.verificationStatus, "verified"),
          eq(marketplaceAgents.isPublic, true),
        ),
      )
      .groupBy(marketplaceAgents.id)
      .orderBy(desc(marketplaceAgents.totalRunCount))
      .limit(limit);
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      totalRunCount: Number(r.totalRunCount),
      creatorRevenueCents: Number(r.creatorRevenueCents),
      views7d: Number(r.views7d ?? 0),
    }));
  } catch (err) {
    log.error("topAgents failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/* ─── Platform earnings aggregate ─────────────────────────────── */

async function earningsAggregate(): Promise<EarningsAggregate> {
  if (!databaseIsConfigured()) return EMPTY_EARNINGS;
  const d30 = since(30);
  try {
    const rows = await db
      .select({
        lifetimeGross: sql<number>`COALESCE(SUM(${creatorEarnings.grossCents}), 0)::int`,
        lifetimePending: sql<number>`COALESCE(SUM(${creatorEarnings.creatorCents}) FILTER (WHERE ${creatorEarnings.status} = 'pending'), 0)::int`,
        lifetimePaid: sql<number>`COALESCE(SUM(${creatorEarnings.creatorCents}) FILTER (WHERE ${creatorEarnings.status} = 'paid'), 0)::int`,
        last30dGross: sql<number>`COALESCE(SUM(${creatorEarnings.grossCents}) FILTER (WHERE ${creatorEarnings.createdAt} >= ${d30}), 0)::int`,
        uniqueCreators: sql<number>`COUNT(DISTINCT ${creatorEarnings.creatorEmail})::int`,
      })
      .from(creatorEarnings);
    const r = rows[0];
    if (!r) return EMPTY_EARNINGS;
    return {
      lifetimeGrossCents: Number(r.lifetimeGross),
      lifetimePendingCents: Number(r.lifetimePending),
      lifetimePaidCents: Number(r.lifetimePaid),
      last30dGrossCents: Number(r.last30dGross),
      uniqueCreators: Number(r.uniqueCreators),
    };
  } catch (err) {
    log.error("earningsAggregate failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return EMPTY_EARNINGS;
  }
}

/* ─── Master query ────────────────────────────────────────────── */

export async function getAdminMetrics(): Promise<AdminMetrics> {
  const [submissions, policies, topAgentsList, earnings] = await Promise.all([
    submissionFunnel(),
    policyBreakdown(),
    topAgents(10),
    earningsAggregate(),
  ]);
  return {
    submissions,
    policies,
    topAgents: topAgentsList,
    earnings,
    generatedAt: new Date().toISOString(),
  };
}

/** Test-only hook — re-export nothing but act as a marker for the
 *  structure tests that probe the module surface. */
void sql;
