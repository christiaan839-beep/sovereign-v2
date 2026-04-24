/**
 * /dashboard/creator — unified home for signed-in creators.
 *
 * One page showing:
 *   - Earnings summary (lifetime + 30d + pending + paid)
 *   - My submitted agents with their verification status + grade
 *   - Quick actions: submit another, manage webhooks, view docs
 *
 * Server-rendered. Fetches earnings + agent list in parallel.
 *
 * Why this exists: creators today land on fragmented surfaces
 * (/dashboard/earnings here, /creators/apply there, /dashboard/webhooks
 * over there). This page collapses "what matters right now" into one view.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { marketplaceAgents } from "@/db/schema";
import { summarizeForCreator } from "@/lib/creator-earnings";

export const metadata: Metadata = {
  title: "Creator Home — Sovereign Dashboard",
  description: "Your agents, your earnings, your recent invocations — in one place.",
  robots: { index: false, follow: false },
};

function databaseIsConfigured(): boolean {
  return typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0;
}

interface MyAgent {
  id: string;
  slug: string | null;
  name: string;
  category: string;
  verificationStatus: string;
  isPublic: boolean;
  pricePerRun: number;
  totalRunCount: number;
  creatorRevenueCents: number;
  createdAt: Date | null;
}

async function listMyAgents(email: string): Promise<MyAgent[]> {
  if (!databaseIsConfigured() || !email) return [];
  try {
    const rows = await db
      .select({
        id: marketplaceAgents.id,
        slug: marketplaceAgents.slug,
        name: marketplaceAgents.name,
        category: marketplaceAgents.category,
        verificationStatus: marketplaceAgents.verificationStatus,
        isPublic: marketplaceAgents.isPublic,
        pricePerRun: marketplaceAgents.pricePerRun,
        totalRunCount: marketplaceAgents.totalRunCount,
        creatorRevenueCents: marketplaceAgents.creatorRevenueCents,
        createdAt: marketplaceAgents.createdAt,
      })
      .from(marketplaceAgents)
      .where(eq(marketplaceAgents.authorEmail, email.toLowerCase()))
      .orderBy(desc(marketplaceAgents.createdAt))
      .limit(50);
    return rows;
  } catch {
    return [];
  }
}

function usd(cents: number): string {
  if (cents === 0) return "$0";
  if (cents < 100) return `${cents}¢`;
  return `$${(cents / 100).toFixed(2)}`;
}

function statusStyle(status: string): { bg: string; color: string; label: string } {
  switch (status) {
    case "verified":
      return { bg: "var(--ed-copper-wash)", color: "var(--ed-copper)", label: "Live" };
    case "pending":
      return { bg: "var(--ed-bg-raised)", color: "var(--ed-ink-soft)", label: "Pending review" };
    case "rejected":
      return { bg: "var(--ed-bg-raised)", color: "var(--ed-ink-soft)", label: "Rejected" };
    case "in_review":
      return { bg: "var(--ed-bg-raised)", color: "var(--ed-ink-soft)", label: "In review" };
    default:
      return { bg: "var(--ed-bg-raised)", color: "var(--ed-ink-soft)", label: status };
  }
}

export default async function Page() {
  const { userId } = await auth();
  if (!userId) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--ed-bg)" }}
      >
        <div className="text-center">
          <p className="ed-body mb-4" style={{ color: "var(--ed-ink)" }}>
            Sign in to see your creator dashboard.
          </p>
          <Link
            href="/sign-in?redirect_url=/dashboard/creator"
            className="ed-mono text-sm"
            style={{ color: "var(--ed-copper)" }}
          >
            Sign in →
          </Link>
        </div>
      </div>
    );
  }

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  const [summary, myAgents] = await Promise.all([
    summarizeForCreator(email),
    listMyAgents(email),
  ]);

  const publishedCount = myAgents.filter((a) => a.verificationStatus === "verified").length;
  const pendingCount = myAgents.filter((a) => a.verificationStatus === "pending").length;

  return (
    <div className="min-h-screen" style={{ background: "var(--ed-bg)" }}>
      <div className="max-w-6xl mx-auto px-6 pt-14 pb-24">
        <nav className="ed-caption mb-10">
          <Link
            href="/dashboard"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            ← Dashboard
          </Link>
        </nav>

        <header className="mb-10">
          <p className="ed-label mb-2" style={{ color: "var(--ed-copper)" }}>
            Creator home
          </p>
          <h1
            className="ed-display text-5xl mb-3"
            style={{ color: "var(--ed-ink)" }}
          >
            Welcome back{user?.firstName ? `, ${user.firstName}` : ""}.
          </h1>
          <p
            className="ed-body max-w-2xl"
            style={{ color: "var(--ed-ink-soft)" }}
          >
            {publishedCount === 0 && pendingCount === 0
              ? "Submit your first agent below — 30 minutes from zero to the marketplace."
              : `${publishedCount} published ${publishedCount === 1 ? "agent" : "agents"}${
                  pendingCount > 0 ? `, ${pendingCount} under review` : ""
                }. Keep shipping.`}
          </p>
        </header>

        {/* Earnings summary (4 cards) */}
        <section className="mb-14">
          <h2 className="ed-label mb-5">Earnings</h2>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Lifetime"
              value={usd(summary.lifetimeCreatorCents)}
              tone="copper"
            />
            <StatCard label="Last 30 days" value={usd(summary.thirtyDayCreatorCents)} />
            <StatCard label="Pending payout" value={usd(summary.pendingCreatorCents)} />
            <StatCard label="Paid out" value={usd(summary.paidCreatorCents)} />
          </dl>
          <p className="ed-caption mt-4" style={{ color: "var(--ed-ink-soft)" }}>
            {summary.invocations} lifetime invocation{summary.invocations === 1 ? "" : "s"} ·{" "}
            <Link
              href="/dashboard/earnings"
              className="transition-colors hover:text-[var(--ed-copper)]"
            >
              Full earnings detail →
            </Link>
          </p>
        </section>

        {/* My agents */}
        <section className="mb-14">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="ed-label">My agents ({myAgents.length})</h2>
            <Link
              href="/creators/apply"
              className="ed-caption transition-colors hover:text-[var(--ed-copper)]"
              style={{ color: "var(--ed-copper)" }}
            >
              Submit another →
            </Link>
          </div>

          {myAgents.length === 0 ? (
            <EmptyState />
          ) : (
            <div style={{ border: "1px solid var(--ed-rule)", borderRadius: "2px" }}>
              <div
                className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-3 ed-label"
                style={{
                  borderBottom: "1px solid var(--ed-rule)",
                  background: "var(--ed-bg-raised)",
                  color: "var(--ed-ink-soft)",
                }}
              >
                <span>Agent</span>
                <span>Status</span>
                <span>Price</span>
                <span>Runs</span>
                <span className="text-right">Earnings</span>
              </div>
              {myAgents.map((a) => {
                const s = statusStyle(a.verificationStatus);
                return (
                  <div
                    key={a.id}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-4 px-5 py-4 items-baseline"
                    style={{ borderBottom: "1px solid var(--ed-rule)" }}
                  >
                    <Link
                      href={
                        a.verificationStatus === "verified"
                          ? a.slug
                            ? `/marketplace/${a.slug}`
                            : `/marketplace/${a.id}`
                          : "#"
                      }
                      className={
                        a.verificationStatus === "verified"
                          ? "ed-body text-sm transition-colors hover:text-[var(--ed-copper)]"
                          : "ed-body text-sm"
                      }
                      style={{ color: "var(--ed-ink)" }}
                    >
                      <span>{a.name}</span>
                      <span
                        className="ed-caption ml-2"
                        style={{ color: "var(--ed-ink-soft)" }}
                      >
                        {a.category}
                      </span>
                    </Link>
                    <span
                      className="ed-mono text-xs px-2 py-1 inline-block w-fit"
                      style={{
                        color: s.color,
                        background: s.bg,
                        borderRadius: "2px",
                      }}
                    >
                      {s.label}
                    </span>
                    <span
                      className="ed-mono text-sm"
                      style={{ color: "var(--ed-ink-soft)" }}
                    >
                      {a.pricePerRun === 0 ? "Free" : usd(a.pricePerRun)}
                    </span>
                    <span
                      className="ed-mono text-sm"
                      style={{ color: "var(--ed-ink-soft)" }}
                    >
                      {a.totalRunCount}
                    </span>
                    <span
                      className="ed-mono text-sm text-right"
                      style={{ color: "var(--ed-copper)" }}
                    >
                      {usd(a.creatorRevenueCents)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Quick actions */}
        <section className="mb-14">
          <h2 className="ed-label mb-5">Quick actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <QuickAction
              href="/creators/apply"
              title="Submit an agent"
              desc="Paste a SAM v1.0 manifest. Auto-validated + reviewed."
            />
            <QuickAction
              href="/dashboard/webhooks"
              title="Webhooks"
              desc="Trigger agents on external events. HMAC-signed both ways."
            />
            <QuickAction
              href="/developers/build-an-agent"
              title="Build-an-agent guide"
              desc="30-min tutorial using the @sovereignmatrix/cli tool."
            />
          </div>
        </section>

        <footer
          className="pt-8 ed-caption flex items-baseline gap-6 flex-wrap"
          style={{ borderTop: "1px solid var(--ed-rule)" }}
        >
          <Link
            href="/dashboard/earnings"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            Earnings detail →
          </Link>
          <Link
            href="/spec/agent-manifest"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            SAM v1.0 spec →
          </Link>
          <Link
            href="/marketplace"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            Public marketplace →
          </Link>
        </footer>
      </div>
    </div>
  );
}

/* ─── Pieces ──────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "copper";
}) {
  return (
    <div
      className="p-5"
      style={{
        border: "1px solid var(--ed-rule)",
        background: "var(--ed-bg-raised)",
        borderRadius: "2px",
      }}
    >
      <dt
        className="ed-label mb-2"
        style={{ color: "var(--ed-ink-soft)" }}
      >
        {label}
      </dt>
      <dd
        className="ed-display"
        style={{
          color: tone === "copper" ? "var(--ed-copper)" : "var(--ed-ink)",
          fontSize: "clamp(1.5rem, 3vw, 2.25rem)",
          lineHeight: 1,
        }}
      >
        {value}
      </dd>
    </div>
  );
}

function QuickAction({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="block p-5 transition-colors group"
      style={{
        border: "1px solid var(--ed-rule)",
        background: "var(--ed-bg-raised)",
        borderRadius: "2px",
      }}
    >
      <p
        className="ed-display text-xl mb-2 transition-colors group-hover:text-[var(--ed-copper)]"
        style={{ color: "var(--ed-ink)" }}
      >
        {title} →
      </p>
      <p className="ed-caption" style={{ color: "var(--ed-ink-soft)" }}>
        {desc}
      </p>
    </Link>
  );
}

function EmptyState() {
  return (
    <div
      className="p-10 text-center"
      style={{
        border: "1px solid var(--ed-rule)",
        background: "var(--ed-bg-raised)",
        color: "var(--ed-ink-soft)",
        borderRadius: "2px",
      }}
    >
      <p className="ed-body mb-3">No agents yet.</p>
      <Link
        href="/creators/apply"
        className="inline-block px-5 py-2 ed-mono text-sm transition-opacity hover:opacity-80"
        style={{
          background: "var(--ed-copper)",
          color: "var(--ed-bg)",
          borderRadius: "2px",
        }}
      >
        Submit your first agent →
      </Link>
    </div>
  );
}
