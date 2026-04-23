/**
 * /admin/metrics — marketplace observability dashboard.
 *
 * Server component. Parallel-fetches 4 aggregate queries via
 * getAdminMetrics() and SSR-renders the whole dashboard — no client
 * JavaScript needed for the first paint. Clerk-gated via isAdmin()
 * with the same 404-for-non-admins posture as the rest of /admin.
 *
 * What's shown (top to bottom):
 *   1. Submission funnel          — last 24h / 7d / 30d + status counts
 *   2. Policy breakdown           — open / curated / trust-tiered splits
 *   3. Top agents (by runs)       — leaderboard w/ revenue + 7d views
 *   4. Platform earnings          — gross / pending / paid / 30d / creators
 *
 * Values are NEVER interpreted on this page — raw numbers only. That's
 * intentional: dashboards that editorialise ("your marketplace is
 * healthy!") age badly. Numbers stay numbers.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin-auth";
import { getAdminMetrics } from "@/lib/admin-metrics";

export const metadata = {
  title: "Metrics — Admin",
  robots: { index: false, follow: false },
};

function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function Page() {
  const { userId } = await auth();
  if (!isAdmin(userId)) notFound();

  const metrics = await getAdminMetrics();

  return (
    <div className="min-h-screen" style={{ background: "var(--ed-bg)" }}>
      <div className="max-w-7xl mx-auto px-6 pt-10 pb-24">
        <header className="mb-10">
          <p className="ed-label mb-2" style={{ color: "var(--ed-copper)" }}>
            Admin
          </p>
          <h1 className="ed-display text-5xl mb-3" style={{ color: "var(--ed-ink)" }}>
            Metrics
          </h1>
          <p className="ed-caption">
            Marketplace observability. Refresh for live numbers.
            Generated: <span className="ed-mono">{metrics.generatedAt}</span>
          </p>
        </header>

        {/* 1. Submission funnel */}
        <section className="mb-14">
          <h2 className="ed-label mb-5">Submissions (SAM v1.0)</h2>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Stat label="Last 24h" value={String(metrics.submissions.last24h)} />
            <Stat label="Last 7 days" value={String(metrics.submissions.last7d)} />
            <Stat label="Last 30 days" value={String(metrics.submissions.last30d)} />
            <Stat label="Total" value={String(metrics.submissions.total)} />
          </dl>
          <dl className="grid grid-cols-3 gap-4">
            <StatusChip
              label="Pending"
              value={metrics.submissions.pending}
              tone="pending"
            />
            <StatusChip
              label="Verified"
              value={metrics.submissions.verified}
              tone="verified"
            />
            <StatusChip
              label="Rejected"
              value={metrics.submissions.rejected}
              tone="rejected"
            />
          </dl>
        </section>

        {/* 2. Policy breakdown */}
        <section className="mb-14">
          <h2 className="ed-label mb-5">Approval policy breakdown</h2>
          {metrics.policies.length === 0 ? (
            <EmptyPanel text="No policy data yet." />
          ) : (
            <div style={{ border: "1px solid var(--ed-rule)", borderRadius: "2px" }}>
              {metrics.policies.map((p) => (
                <div
                  key={p.policy}
                  className="flex items-baseline justify-between px-5 py-3"
                  style={{ borderBottom: "1px solid var(--ed-rule)" }}
                >
                  <span className="ed-mono text-sm" style={{ color: "var(--ed-ink)" }}>
                    {p.policy}
                  </span>
                  <span className="ed-mono text-sm" style={{ color: "var(--ed-copper)" }}>
                    {p.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 3. Top agents */}
        <section className="mb-14">
          <h2 className="ed-label mb-5">Top agents — by total runs</h2>
          {metrics.topAgents.length === 0 ? (
            <EmptyPanel text="No runs recorded yet." />
          ) : (
            <div style={{ border: "1px solid var(--ed-rule)", borderRadius: "2px" }}>
              <div
                className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-5 py-3 ed-label"
                style={{
                  borderBottom: "1px solid var(--ed-rule)",
                  background: "var(--ed-bg-raised)",
                  color: "var(--ed-ink-soft)",
                }}
              >
                <span>Agent</span>
                <span>Runs</span>
                <span>Views (7d)</span>
                <span className="text-right">Creator rev</span>
              </div>
              {metrics.topAgents.map((a) => (
                <div
                  key={a.id}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 px-5 py-3 items-baseline"
                  style={{ borderBottom: "1px solid var(--ed-rule)" }}
                >
                  <Link
                    href={a.slug ? `/marketplace/${a.slug}` : `/marketplace/${a.id}`}
                    className="ed-body text-sm transition-colors hover:text-[var(--ed-copper)]"
                    style={{ color: "var(--ed-ink)" }}
                  >
                    {a.name}
                  </Link>
                  <span className="ed-mono text-sm" style={{ color: "var(--ed-ink-soft)" }}>
                    {a.totalRunCount}
                  </span>
                  <span className="ed-mono text-sm" style={{ color: "var(--ed-ink-soft)" }}>
                    {a.views7d}
                  </span>
                  <span
                    className="ed-mono text-sm text-right"
                    style={{ color: "var(--ed-copper)" }}
                  >
                    {usd(a.creatorRevenueCents)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 4. Earnings aggregate */}
        <section className="mb-14">
          <h2 className="ed-label mb-5">Creator earnings</h2>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat
              label="Lifetime gross"
              value={usd(metrics.earnings.lifetimeGrossCents)}
            />
            <Stat
              label="Pending (creator)"
              value={usd(metrics.earnings.lifetimePendingCents)}
              tone="copper"
            />
            <Stat
              label="Paid (creator)"
              value={usd(metrics.earnings.lifetimePaidCents)}
            />
            <Stat
              label="Unique creators"
              value={String(metrics.earnings.uniqueCreators)}
            />
          </dl>
          <p className="ed-caption mt-4">
            30-day gross: <span className="ed-mono">{usd(metrics.earnings.last30dGrossCents)}</span>
          </p>
        </section>

        <footer
          className="pt-8 ed-caption flex items-baseline gap-6 flex-wrap"
          style={{ borderTop: "1px solid var(--ed-rule)" }}
        >
          <Link
            href="/admin/creator-submissions"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            Review queue →
          </Link>
          <Link
            href="/admin/creator-submissions?status=verified"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            Published agents →
          </Link>
        </footer>
      </div>
    </div>
  );
}

/* ─── Pieces ──────────────────────────────────────────────────── */

function Stat({
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
      <dt className="ed-label mb-2" style={{ color: "var(--ed-ink-soft)" }}>
        {label}
      </dt>
      <dd
        className="ed-display"
        style={{
          color: tone === "copper" ? "var(--ed-copper)" : "var(--ed-ink)",
          fontSize: "clamp(1.25rem, 2vw, 1.85rem)",
          lineHeight: 1,
        }}
      >
        {value}
      </dd>
    </div>
  );
}

function StatusChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "pending" | "verified" | "rejected";
}) {
  const color =
    tone === "rejected" ? "var(--ed-copper)" : tone === "verified" ? "var(--ed-ink)" : "var(--ed-ink-soft)";
  return (
    <div
      className="p-5 flex items-baseline justify-between"
      style={{
        border: "1px solid var(--ed-rule)",
        borderRadius: "2px",
      }}
    >
      <span className="ed-label">{label}</span>
      <span className="ed-mono text-2xl" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function EmptyPanel({ text }: { text: string }) {
  return (
    <div
      className="p-8 text-center"
      style={{
        border: "1px solid var(--ed-rule)",
        background: "var(--ed-bg-raised)",
        color: "var(--ed-ink-soft)",
        borderRadius: "2px",
      }}
    >
      <p className="ed-body">{text}</p>
    </div>
  );
}
