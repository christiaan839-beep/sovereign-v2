/**
 * /marketplace/bundles — public index of curated agent bundles.
 *
 * Server-rendered. Shows every public bundle with its member count,
 * category, price, and discount-vs-sum-of-components. Buyers land
 * here when they're shopping for a whole workflow, not an individual
 * agent.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  bundleDiscountPct,
  listPublicBundles,
  sumOfComponentPrices,
} from "@/lib/agent-bundles";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Bundles — Sovereign Marketplace",
  description:
    "Curated sets of agents published as one purchasable unit. Buy a workflow, not a tool. Real Estate Listing Pack, Customer Support Kit, Finance Ops Bundle, and more.",
};

function usd(cents: number): string {
  if (cents === 0) return "Free";
  if (cents < 100) return `${cents}¢`;
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function Page() {
  const bundles = await listPublicBundles({ limit: 60 });

  return (
    <div className="min-h-screen" style={{ background: "var(--ed-bg)" }}>
      <div className="max-w-6xl mx-auto px-6 pt-14 pb-24">
        <nav className="ed-caption mb-10">
          <Link
            href="/marketplace"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            ← Marketplace
          </Link>
        </nav>

        <header className="mb-10">
          <p className="ed-label mb-2" style={{ color: "var(--ed-copper)" }}>
            Bundles
          </p>
          <h1
            className="ed-display text-5xl mb-4"
            style={{ color: "var(--ed-ink)" }}
          >
            Buy a workflow, not a tool.
          </h1>
          <p
            className="ed-body max-w-2xl"
            style={{ color: "var(--ed-ink-soft)" }}
          >
            Each bundle is a curated set of 3–10 agents that solve an entire
            workflow. Pay one price, invoke the bundle, and earnings flow to
            every creator whose agent contributed — via SAM v1.0{" "}
            <code className="ed-mono">dependsOn</code> resolution.
          </p>
        </header>

        {bundles.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bundles.map((b) => {
              const sum = sumOfComponentPrices(b);
              const discount = bundleDiscountPct(b);
              return (
                <Link
                  key={b.id}
                  href={`/marketplace/bundles/${b.slug}`}
                  className="group block p-6 transition-colors"
                  style={{
                    border: "1px solid var(--ed-rule)",
                    background: "var(--ed-bg-raised)",
                    borderRadius: "2px",
                  }}
                >
                  <div className="flex items-baseline justify-between mb-3">
                    <span
                      className="ed-label"
                      style={{ color: "var(--ed-copper)" }}
                    >
                      {b.category}
                    </span>
                    <span
                      className="ed-mono text-xs"
                      style={{ color: "var(--ed-ink-soft)" }}
                    >
                      {b.members.length} agent
                      {b.members.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <h2
                    className="ed-display text-2xl mb-3 transition-colors group-hover:text-[var(--ed-copper)]"
                    style={{ color: "var(--ed-ink)" }}
                  >
                    {b.name}
                  </h2>
                  <p
                    className="ed-body text-sm mb-5"
                    style={{ color: "var(--ed-ink-soft)" }}
                  >
                    {b.description}
                  </p>

                  <div
                    className="pt-4 flex items-baseline justify-between gap-2"
                    style={{ borderTop: "1px solid var(--ed-rule)" }}
                  >
                    <span
                      className="ed-display text-xl"
                      style={{ color: "var(--ed-copper)" }}
                    >
                      {usd(b.priceCents)}
                    </span>
                    {discount > 0 && (
                      <span
                        className="ed-mono text-xs"
                        style={{ color: "var(--ed-ink-soft)" }}
                      >
                        {discount}% off {usd(sum)} sum
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        <footer
          className="mt-14 pt-8 ed-caption flex items-baseline gap-6 flex-wrap"
          style={{ borderTop: "1px solid var(--ed-rule)" }}
        >
          <Link
            href="/marketplace/leaderboard"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            Top agents →
          </Link>
          <Link
            href="/marketplace/search"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            Search agents →
          </Link>
          <Link
            href="/creators/apply"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            Publish your own →
          </Link>
        </footer>
      </div>
    </div>
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
      <p className="ed-body mb-3">No public bundles yet.</p>
      <p className="ed-caption">
        Creators can compose 3–10 agents into a bundle and publish via the
        admin review queue.
      </p>
    </div>
  );
}
