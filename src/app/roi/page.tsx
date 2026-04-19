"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

/**
 * ROI — Editorial Museum aesthetic.
 *
 * User checks which categories of tools their stack includes.
 * Each category has a typical market price band. We sum the mid-point.
 * Compared against Sovereign's flat $199/mo.
 *
 * Design rules (same as /built-with-claude):
 *   - Instrument Serif display + Inter Tight body + JetBrains Mono data
 *   - Cream / charcoal / copper accent (#B5532C)
 *   - No competitor names. Categories only.
 *   - Honest math — no "3.4x leads" fabrication.
 */

interface ToolCategory {
  id: string;
  label: string;
  subcopy: string;
  lowUsd: number;
  highUsd: number;
}

const CATEGORIES: ToolCategory[] = [
  { id: "crm",        label: "CRM + pipeline",          subcopy: "Contacts, deal stages, forecasting",        lowUsd: 50,  highUsd: 890 },
  { id: "enrich",     label: "Contact enrichment",      subcopy: "Emails, phone numbers, firmographics",      lowUsd: 75,  highUsd: 200 },
  { id: "outreach",   label: "Cold email + sequences",  subcopy: "Multi-step outbound, reply tracking",       lowUsd: 80,  highUsd: 250 },
  { id: "content",    label: "AI writing",              subcopy: "Blog, social, email copywriting",           lowUsd: 40,  highUsd: 120 },
  { id: "seo",        label: "SEO + keyword research",  subcopy: "Keyword volume, rank tracking, audits",     lowUsd: 120, highUsd: 400 },
  { id: "automation", label: "Workflow automation",     subcopy: "Multi-step job orchestration",              lowUsd: 25,  highUsd: 100 },
  { id: "voice",      label: "AI voice / dialer",       subcopy: "Outbound calls, call qualification",        lowUsd: 60,  highUsd: 300 },
  { id: "intel",      label: "Competitor intelligence", subcopy: "Website changes, pricing, messaging",       lowUsd: 50,  highUsd: 200 },
  { id: "chat",       label: "AI chat assistant",       subcopy: "ChatGPT Plus, Claude Pro, etc",             lowUsd: 20,  highUsd: 40  },
  { id: "scraping",   label: "Web data + scraping",     subcopy: "Apify, proxies, LinkedIn scrapers",         lowUsd: 30,  highUsd: 200 },
];

const SOVEREIGN_MONTHLY_USD = 199;

export default function RoiPage() {
  const [selected, setSelected] = useState<Set<string>>(
    // Default-check the most common five so visitors see math immediately
    new Set(["crm", "enrich", "outreach", "content", "seo"]),
  );

  const totals = useMemo(() => {
    let low = 0;
    let high = 0;
    let mid = 0;
    for (const cat of CATEGORIES) {
      if (selected.has(cat.id)) {
        low += cat.lowUsd;
        high += cat.highUsd;
        mid += Math.round((cat.lowUsd + cat.highUsd) / 2);
      }
    }
    const monthlySavings = Math.max(0, mid - SOVEREIGN_MONTHLY_USD);
    const annualSavings = monthlySavings * 12;
    const toolsCount = selected.size;
    return { low, high, mid, monthlySavings, annualSavings, toolsCount };
  }, [selected]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

  return (
    <div className="editorial-light min-h-screen">
      <div className="ed-page py-12 md:py-20">
        <div className="ed-max">

          {/* Masthead */}
          <div className="flex items-baseline justify-between mb-10 ed-fade-in">
            <Link href="/" className="ed-label hover:ed-copper transition-colors">
              ← Sovereign Matrix
            </Link>
            <p className="ed-caption">ROI Worksheet · April 2026</p>
          </div>

          {/* Title */}
          <header className="ed-grid-12 mb-14">
            <div className="col-span-12 md:col-span-9">
              <p className="ed-label mb-6 ed-enter ed-d-1">Worksheet</p>
              <h1
                className="ed-display ed-enter ed-d-2"
                style={{
                  fontSize: "clamp(48px, 9vw, 112px)",
                  lineHeight: 0.9,
                  letterSpacing: "-0.025em",
                }}
              >
                What your stack{" "}
                <em className="ed-display-italic ed-copper">actually</em> costs.
              </h1>
            </div>
            <aside
              className="col-span-12 md:col-span-3 md:pl-6 md:border-l mt-10 md:mt-0 pt-4 md:pt-2 ed-enter ed-d-3"
              style={{ borderColor: "var(--ed-rule)" }}
            >
              <p className="ed-label mb-4">Method</p>
              <p className="ed-body text-[13px]" style={{ color: "var(--ed-ink-soft)" }}>
                Check the categories of tools in your current stack. We show
                typical market price bands and the mid-point. Sovereign Matrix
                is $199/mo flat on the Node tier — one line.
              </p>
            </aside>
          </header>

          {/* Dek */}
          <div className="ed-grid-12 mb-16">
            <div className="col-span-12 md:col-span-8 md:col-start-2 ed-enter ed-d-4">
              <p
                className="ed-display"
                style={{
                  fontSize: "clamp(20px, 2.4vw, 30px)",
                  lineHeight: 1.35,
                  color: "var(--ed-ink-soft)",
                }}
              >
                The honest comparison isn&apos;t feature-by-feature — it&apos;s{" "}
                <em className="ed-display-italic ed-copper">how much you&apos;re already paying</em>{" "}
                for the same capabilities spread across eight invoices.
              </p>
            </div>
          </div>

          {/* Live total — big number */}
          <section
            className="ed-grid-12 py-10 border-y mb-14 ed-enter ed-d-5"
            style={{ borderColor: "var(--ed-rule)" }}
          >
            <div className="col-span-12 md:col-span-4">
              <p className="ed-label">Your stack</p>
              <p
                className="ed-display tabular-nums"
                style={{ fontSize: "clamp(36px, 5vw, 64px)", lineHeight: 0.95 }}
              >
                {totals.toolsCount ? usd(totals.mid) : "—"}
                <span className="ed-caption block mt-2">/month, mid-point</span>
              </p>
              {totals.toolsCount ? (
                <p className="ed-caption mt-1">
                  range: {usd(totals.low)}–{usd(totals.high)}
                </p>
              ) : null}
            </div>
            <div className="col-span-12 md:col-span-4 mt-6 md:mt-0">
              <p className="ed-label">Sovereign Matrix</p>
              <p
                className="ed-display tabular-nums"
                style={{ fontSize: "clamp(36px, 5vw, 64px)", lineHeight: 0.95 }}
              >
                {usd(SOVEREIGN_MONTHLY_USD)}
                <span className="ed-caption block mt-2">/month, one line</span>
              </p>
              <p className="ed-caption mt-1">Node tier · unlimited runs</p>
            </div>
            <div className="col-span-12 md:col-span-4 mt-6 md:mt-0">
              <p className="ed-label ed-copper">Annual savings</p>
              <p
                className="ed-display tabular-nums ed-copper"
                style={{ fontSize: "clamp(36px, 5vw, 64px)", lineHeight: 0.95 }}
              >
                {totals.monthlySavings > 0 ? usd(totals.annualSavings) : "$0"}
              </p>
              <p className="ed-caption mt-1" style={{ color: "var(--ed-copper)" }}>
                across {totals.toolsCount} tool {totals.toolsCount === 1 ? "category" : "categories"}
              </p>
            </div>
          </section>

          {/* Category picker */}
          <section className="mb-20">
            <div className="ed-grid-12 mb-8">
              <div className="col-span-12 md:col-span-3">
                <p className="ed-label">Chapter I</p>
              </div>
              <div className="col-span-12 md:col-span-9">
                <h2
                  className="ed-display"
                  style={{
                    fontSize: "clamp(32px, 4.5vw, 54px)",
                    lineHeight: 0.95,
                    letterSpacing: "-0.015em",
                  }}
                >
                  Check the tools you <em className="ed-display-italic">actually</em> use.
                </h2>
              </div>
            </div>

            <div
              className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-0 border-t"
              style={{ borderColor: "var(--ed-rule-soft)" }}
            >
              {CATEGORIES.map((cat, i) => {
                const isOn = selected.has(cat.id);
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggle(cat.id)}
                    className="flex items-start gap-4 py-5 border-b text-left transition-all group"
                    style={{ borderColor: "var(--ed-rule-soft)" }}
                  >
                    <span
                      className="flex-shrink-0 w-5 h-5 mt-1 flex items-center justify-center rounded-full border-2 transition-all"
                      style={{
                        borderColor: isOn ? "var(--ed-copper)" : "var(--ed-rule)",
                        background: isOn ? "var(--ed-copper)" : "transparent",
                      }}
                    >
                      {isOn && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path
                            d="M1 4L4 7L9 1"
                            stroke="var(--ed-bg)"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-baseline justify-between gap-3 flex-wrap">
                        <div className="flex items-baseline gap-3">
                          <span className="ed-mono text-[10px]" style={{ color: "var(--ed-ink-dim)" }}>
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span
                            className="ed-display text-[22px]"
                            style={{
                              color: isOn ? "var(--ed-ink)" : "var(--ed-ink-soft)",
                              lineHeight: 1.1,
                            }}
                          >
                            {cat.label}
                          </span>
                        </div>
                        <span
                          className="ed-mono text-[11px] tabular-nums"
                          style={{ color: isOn ? "var(--ed-copper)" : "var(--ed-ink-dim)" }}
                        >
                          ${cat.lowUsd}–${cat.highUsd}/mo
                        </span>
                      </div>
                      <p
                        className="ed-body text-[13px] mt-1"
                        style={{ color: "var(--ed-ink-dim)" }}
                      >
                        {cat.subcopy}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="ed-caption mt-6">
              Price bands are approximate market mid-points sourced from
              publicly-advertised entry-tier plans in April 2026. Actual
              savings depend on your tier selection and usage volume.
            </p>
          </section>

          {/* Pull quote */}
          <section className="my-24 ed-grid-12">
            <div className="col-span-12 md:col-span-10 md:col-start-2">
              <div
                className="ed-mono ed-copper text-[60px] mb-4"
                style={{ lineHeight: 0.5 }}
              >
                &ldquo;
              </div>
              <blockquote
                className="ed-display-italic"
                style={{
                  fontSize: "clamp(26px, 3.5vw, 44px)",
                  lineHeight: 1.2,
                  letterSpacing: "-0.01em",
                  color: "var(--ed-ink)",
                }}
              >
                The cheapest tool isn&apos;t the one with the lowest monthly price.
                It&apos;s the one that replaces <em className="not-italic ed-copper">eight</em> others.
              </blockquote>
              <div className="flex items-center gap-4 mt-8">
                <div
                  className="ed-rule w-16"
                  style={{ background: "var(--ed-copper)" }}
                />
                <p className="ed-label">Operating principle · §1</p>
              </div>
            </div>
          </section>

          {/* CTA */}
          <section
            className="my-20 border-y py-16 ed-grid-12"
            style={{ borderColor: "var(--ed-rule)" }}
          >
            <div className="col-span-12 md:col-span-8 md:col-start-3 text-center">
              <p className="ed-label mb-5">Ready to replace the stack</p>
              <h2
                className="ed-display mb-8"
                style={{
                  fontSize: "clamp(32px, 4vw, 50px)",
                  lineHeight: 0.95,
                  letterSpacing: "-0.015em",
                }}
              >
                Start for <em className="ed-display-italic ed-copper">free.</em>
                <br />
                No credit card. No trial countdown.
              </h2>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/signup"
                  className="ed-display-italic inline-block text-[22px] ed-copper border-b-2 pb-1 transition-all hover:pl-2"
                  style={{ borderColor: "var(--ed-copper)" }}
                >
                  Start free →
                </Link>
                <span className="ed-caption hidden sm:inline">·</span>
                <Link
                  href="/pricing"
                  className="ed-body text-[15px] hover:ed-copper transition-colors"
                  style={{ color: "var(--ed-ink-soft)" }}
                >
                  See all five tiers
                </Link>
              </div>
            </div>
          </section>

          {/* Colophon */}
          <footer
            className="border-t pt-8 pb-4 ed-grid-12"
            style={{ borderColor: "var(--ed-rule)" }}
          >
            <div className="col-span-12 md:col-span-6">
              <p className="ed-label mb-3">Colophon</p>
              <p
                className="ed-body text-[13px]"
                style={{ color: "var(--ed-ink-soft)", lineHeight: 1.7 }}
              >
                Price bands are public entry-tier averages. The mid-point is the
                arithmetic mean of low and high. Sovereign Matrix monthly is the
                published Node-tier price. No affiliate relationships. No
                competitor names; we describe categories, not brands.
              </p>
            </div>
            <div className="col-span-12 md:col-span-6 md:text-right mt-8 md:mt-0">
              <p className="ed-caption">
                Sovereign Matrix · Cape Town · 2026
              </p>
              <p className="ed-caption mt-1">
                <Link href="/" className="hover:ed-copper">Home</Link>
                {" · "}
                <Link href="/pricing" className="hover:ed-copper">Pricing</Link>
                {" · "}
                <Link href="/built-with-claude" className="hover:ed-copper">Built with Claude</Link>
              </p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
