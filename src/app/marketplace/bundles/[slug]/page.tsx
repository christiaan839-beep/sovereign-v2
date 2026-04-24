/**
 * /marketplace/bundles/[slug] — single-bundle detail page.
 *
 * Server-rendered. Shows bundle metadata, member agents (each linked
 * to its marketplace detail page), split preview, and a future CTA
 * for bundle invocation.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  bundleDiscountPct,
  getBundleBySlug,
  splitBundleEarnings,
  sumOfComponentPrices,
} from "@/lib/agent-bundles";

type RouteParams = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: RouteParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const bundle = await getBundleBySlug(slug);
  if (!bundle) return { title: "Bundle — Sovereign Marketplace" };
  return {
    title: `${bundle.name} — Bundle on Sovereign Marketplace`,
    description: bundle.description,
    openGraph: {
      title: bundle.name,
      description: bundle.description,
    },
  };
}

function usd(cents: number): string {
  if (cents === 0) return "Free";
  if (cents < 100) return `${cents}¢`;
  return `$${(cents / 100).toFixed(2)}`;
}

export default async function Page({ params }: { params: RouteParams }) {
  const { slug } = await params;
  const bundle = await getBundleBySlug(slug);
  if (!bundle) notFound();

  const sum = sumOfComponentPrices(bundle);
  const discount = bundleDiscountPct(bundle);

  // Preview the split math for buyers so the 70/30 + sub-member
  // breakdown is visible before they run anything.
  const split = splitBundleEarnings({
    priceCents: bundle.priceCents,
    creatorSharePct: bundle.creatorSharePct,
    members: bundle.members.map((m) => ({
      agentId: m.agentId,
      agentSlug: m.agentSlug,
      sharePct: m.sharePct,
    })),
  });

  return (
    <div className="min-h-screen" style={{ background: "var(--ed-bg)" }}>
      <article className="max-w-5xl mx-auto px-6 pt-14 pb-24">
        <nav className="ed-caption mb-10">
          <Link
            href="/marketplace/bundles"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            ← All bundles
          </Link>
        </nav>

        <header className="mb-10">
          <p className="ed-label mb-2" style={{ color: "var(--ed-copper)" }}>
            {bundle.category} bundle
          </p>
          <h1
            className="ed-display text-5xl mb-4"
            style={{ color: "var(--ed-ink)" }}
          >
            {bundle.name}
          </h1>
          <p
            className="ed-body text-lg max-w-3xl"
            style={{ color: "var(--ed-ink-soft)" }}
          >
            {bundle.description}
          </p>
        </header>

        {/* Metadata row */}
        <dl
          className="flex flex-wrap gap-x-10 gap-y-4 pb-8 mb-10"
          style={{ borderBottom: "1px solid var(--ed-rule)" }}
        >
          <MetaField label="Bundle price" value={usd(bundle.priceCents)} tone="copper" />
          <MetaField label="Sum of components" value={usd(sum)} />
          {discount > 0 && (
            <MetaField
              label="Bundle discount"
              value={`${discount}% off`}
              tone="copper"
            />
          )}
          <MetaField label="Agents" value={String(bundle.members.length)} />
          <MetaField
            label="Creator share"
            value={`${bundle.creatorSharePct}%`}
          />
        </dl>

        {/* Members */}
        <section className="mb-14">
          <h2 className="ed-label mb-5">Agents in this bundle</h2>
          <div
            style={{
              border: "1px solid var(--ed-rule)",
              borderRadius: "2px",
            }}
          >
            <div
              className="grid grid-cols-[auto_2fr_1fr_1fr_1fr] gap-4 px-5 py-3 ed-label"
              style={{
                borderBottom: "1px solid var(--ed-rule)",
                background: "var(--ed-bg-raised)",
                color: "var(--ed-ink-soft)",
              }}
            >
              <span>#</span>
              <span>Agent</span>
              <span>Solo price</span>
              <span>Share</span>
              <span className="text-right">Per-run earning</span>
            </div>
            {bundle.members.map((m, idx) => {
              const perMember = split.perMember.find((p) => p.agentId === m.agentId);
              return (
                <div
                  key={m.agentId}
                  className="grid grid-cols-[auto_2fr_1fr_1fr_1fr] gap-4 px-5 py-4 items-baseline"
                  style={{ borderBottom: "1px solid var(--ed-rule)" }}
                >
                  <span
                    className="ed-mono text-sm"
                    style={{ color: "var(--ed-copper)" }}
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <Link
                    href={`/marketplace/${m.agentSlug}`}
                    className="ed-body text-sm transition-colors hover:text-[var(--ed-copper)]"
                    style={{ color: "var(--ed-ink)" }}
                  >
                    {m.agentName}
                  </Link>
                  <span
                    className="ed-mono text-sm"
                    style={{ color: "var(--ed-ink-soft)" }}
                  >
                    {usd(m.agentPriceCents)}
                  </span>
                  <span
                    className="ed-mono text-sm"
                    style={{ color: "var(--ed-ink-soft)" }}
                  >
                    {m.sharePct}%
                  </span>
                  <span
                    className="ed-mono text-sm text-right"
                    style={{ color: "var(--ed-copper)" }}
                  >
                    {usd(perMember?.creatorCents ?? 0)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Split preview */}
        <section className="mb-14">
          <h2 className="ed-label mb-5">Earnings split (per invocation)</h2>
          <div
            className="p-5"
            style={{
              border: "1px solid var(--ed-copper)",
              background: "var(--ed-copper-wash)",
              borderRadius: "2px",
            }}
          >
            <dl className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <dt
                  className="ed-label mb-1"
                  style={{ color: "var(--ed-ink-soft)" }}
                >
                  Platform share
                </dt>
                <dd
                  className="ed-display text-3xl"
                  style={{ color: "var(--ed-ink)" }}
                >
                  {usd(split.platformCents)}
                </dd>
              </div>
              <div>
                <dt
                  className="ed-label mb-1"
                  style={{ color: "var(--ed-ink-soft)" }}
                >
                  Creator pool
                </dt>
                <dd
                  className="ed-display text-3xl"
                  style={{ color: "var(--ed-copper)" }}
                >
                  {usd(split.creatorPoolCents)}
                </dd>
              </div>
              <div>
                <dt
                  className="ed-label mb-1"
                  style={{ color: "var(--ed-ink-soft)" }}
                >
                  Members earning
                </dt>
                <dd
                  className="ed-display text-3xl"
                  style={{ color: "var(--ed-ink)" }}
                >
                  {bundle.members.length}
                </dd>
              </div>
            </dl>
            <p
              className="ed-caption mt-4 pt-4"
              style={{
                borderTop: "1px solid var(--ed-rule)",
                color: "var(--ed-ink-soft)",
              }}
            >
              Split is honest + deterministic — same bundle, same price, same
              split every invocation. Rounding remainder flows to the first
              member, never to the platform.
            </p>
          </div>
        </section>

        <footer
          className="pt-8 ed-caption flex items-baseline gap-6 flex-wrap"
          style={{ borderTop: "1px solid var(--ed-rule)" }}
        >
          <span>
            Published by{" "}
            <span
              className="ed-mono"
              style={{ color: "var(--ed-copper)" }}
            >
              {bundle.publisherEmail}
            </span>
          </span>
          <Link
            href="/marketplace/bundles"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            ← All bundles
          </Link>
        </footer>
      </article>
    </div>
  );
}

function MetaField({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "copper";
}) {
  return (
    <div>
      <dt
        className="ed-label mb-1"
        style={{ color: "var(--ed-ink-soft)" }}
      >
        {label}
      </dt>
      <dd
        className="ed-body"
        style={{
          color: tone === "copper" ? "var(--ed-copper)" : "var(--ed-ink)",
        }}
      >
        {value}
      </dd>
    </div>
  );
}
