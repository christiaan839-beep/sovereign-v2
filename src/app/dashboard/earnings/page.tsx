/**
 * /dashboard/earnings — creator earnings dashboard.
 *
 * Server component. Queries summarizeForCreator + earningsByAgent
 * directly (no API round-trip). First paint shows real numbers.
 *
 * Hierarchy:
 *   1. Hero stat — lifetime creator earnings (the big number)
 *   2. Secondary row — 30d / paid / pending / invocations
 *   3. Per-agent breakdown (30d)
 *   4. Payout status block — Connect onboarding CTA if not connected
 */

import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import {
  earningsByAgentForCreator,
  summarizeForCreator,
} from "@/lib/creator-earnings";

export const metadata = {
  title: "Earnings — Creator Dashboard",
  robots: { index: false, follow: false },
};

function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function Page() {
  const { userId } = await auth();
  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--ed-bg)" }}>
        <div className="text-center">
          <p className="ed-body mb-4" style={{ color: "var(--ed-ink)" }}>
            Sign in to view your earnings.
          </p>
          <Link
            href="/sign-in?redirect_url=/dashboard/earnings"
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

  const [summary, byAgent] = await Promise.all([
    summarizeForCreator(email),
    earningsByAgentForCreator(email, 30),
  ]);

  const hasEarnings = summary.invocations > 0;

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

        <header className="mb-14">
          <p className="ed-label mb-2" style={{ color: "var(--ed-copper)" }}>
            Earnings
          </p>
          <h1
            className="ed-display mb-6"
            style={{ color: "var(--ed-ink)", fontSize: "clamp(3rem, 6vw, 5.5rem)", lineHeight: 1 }}
          >
            {usd(summary.lifetimeCreatorCents)}
          </h1>
          <p className="ed-body text-lg max-w-2xl" style={{ color: "var(--ed-ink-soft)" }}>
            Lifetime creator-share earnings.{" "}
            <span className="ed-mono text-sm" style={{ color: "var(--ed-ink-soft)" }}>
              (70% of every invocation)
            </span>
          </p>
        </header>

        {/* Secondary stats */}
        <dl
          className="grid grid-cols-2 md:grid-cols-4 gap-6 pb-10 mb-14"
          style={{ borderBottom: "1px solid var(--ed-rule)" }}
        >
          <Stat label="Last 30 days" value={usd(summary.thirtyDayCreatorCents)} />
          <Stat label="Paid out" value={usd(summary.paidCreatorCents)} />
          <Stat label="Pending payout" value={usd(summary.pendingCreatorCents)} />
          <Stat label="Invocations" value={String(summary.invocations)} />
        </dl>

        {!hasEarnings ? (
          <EmptyState />
        ) : (
          <>
            {/* Per-agent breakdown */}
            <section className="mb-14">
              <h2 className="ed-label mb-5">Agents — last 30 days</h2>
              <div style={{ border: "1px solid var(--ed-rule)", borderRadius: "2px" }}>
                <div
                  className="grid grid-cols-[2fr_1fr_1fr] gap-4 px-5 py-3 ed-label"
                  style={{
                    borderBottom: "1px solid var(--ed-rule)",
                    background: "var(--ed-bg-raised)",
                    color: "var(--ed-ink-soft)",
                  }}
                >
                  <span>Agent</span>
                  <span>Invocations</span>
                  <span className="text-right">Earnings</span>
                </div>
                {byAgent.map((a) => (
                  <div
                    key={a.agentId}
                    className="grid grid-cols-[2fr_1fr_1fr] gap-4 px-5 py-4 items-baseline"
                    style={{ borderBottom: "1px solid var(--ed-rule)" }}
                  >
                    <Link
                      href={a.slug ? `/marketplace/${a.slug}` : `/marketplace/${a.agentId}`}
                      className="ed-body transition-colors hover:text-[var(--ed-copper)]"
                      style={{ color: "var(--ed-ink)" }}
                    >
                      {a.name}
                    </Link>
                    <span className="ed-mono text-sm" style={{ color: "var(--ed-ink-soft)" }}>
                      {a.invocations}
                    </span>
                    <span
                      className="ed-mono text-sm text-right"
                      style={{ color: "var(--ed-copper)" }}
                    >
                      {usd(a.creatorCents)}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <PayoutStatusBlock />
          </>
        )}

        <footer
          className="pt-8 ed-caption flex items-baseline gap-6 flex-wrap"
          style={{ borderTop: "1px solid var(--ed-rule)" }}
        >
          <Link
            href="/creators/apply"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            Submit another agent →
          </Link>
          <Link
            href="/spec/agent-manifest"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            SAM v1.0 spec
          </Link>
          <span>Split: 70% creator · 30% platform. Rounding favours the creator.</span>
        </footer>
      </div>
    </div>
  );
}

/* ─── Pieces ──────────────────────────────────────────────────── */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="ed-label mb-2" style={{ color: "var(--ed-ink-soft)" }}>
        {label}
      </dt>
      <dd
        className="ed-display"
        style={{ color: "var(--ed-ink)", fontSize: "clamp(1.5rem, 3vw, 2.25rem)", lineHeight: 1 }}
      >
        {value}
      </dd>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="p-10 text-center mb-14"
      style={{
        border: "1px solid var(--ed-rule)",
        background: "var(--ed-bg-raised)",
        borderRadius: "2px",
      }}
    >
      <p className="ed-body text-lg mb-3" style={{ color: "var(--ed-ink)" }}>
        No invocations yet.
      </p>
      <p className="ed-caption mb-6">
        Once a user runs one of your agents, earnings land here.
      </p>
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

function PayoutStatusBlock() {
  // Stripe Connect onboarding is a separate flow (gap G6 in the
  // session roadmap). For today, this block links to a future
  // /dashboard/payout-setup page that initiates Stripe Connect.
  return (
    <section className="mb-14">
      <h2 className="ed-label mb-5">Payout</h2>
      <div
        className="p-6 flex items-center gap-6 flex-wrap"
        style={{
          border: "1px solid var(--ed-copper)",
          background: "var(--ed-copper-wash)",
          borderRadius: "2px",
        }}
      >
        <div className="flex-1 min-w-[260px]">
          <p className="ed-body mb-1" style={{ color: "var(--ed-ink)" }}>
            Connect a Stripe account to receive payouts.
          </p>
          <p className="ed-caption">
            Monthly payouts on the 1st. Minimum $10. Standard Stripe Connect fees apply.
          </p>
        </div>
        <Link
          href="/dashboard/payout-setup"
          className="inline-block px-5 py-2 ed-mono text-sm transition-opacity hover:opacity-80"
          style={{
            background: "var(--ed-copper)",
            color: "var(--ed-bg)",
            borderRadius: "2px",
          }}
        >
          Connect Stripe →
        </Link>
      </div>
    </section>
  );
}
