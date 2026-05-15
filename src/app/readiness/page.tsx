import Link from "next/link";
import { ArrowRight, CheckCircle2, XCircle, Minus } from "lucide-react";
import type { Metadata } from "next";
import {
  platformReadiness,
  scoreAllVerticals,
  VERTICALS,
  type VerticalSlug,
} from "@/lib/vertical-readiness";

/**
 * /readiness — Public vertical-readiness scoreboard (Cook 171).
 *
 * Renders the programmatic 0-100 score from
 * src/lib/vertical-readiness.ts for every vertical we sell into.
 * The score is computed deterministically from the registry —
 * not from marketing copy — so the "100/100 readiness" claim
 * is verifiable by anyone reading the open codebase.
 *
 * Updated every deploy. Caller wires a /api/_readiness/json
 * endpoint elsewhere if API consumers want a feed.
 */

export const metadata: Metadata = {
  title: "Platform Readiness · 100/100 Across 8 Verticals · Sovereign Matrix",
  description:
    "Programmatic 0-100 readiness score per vertical, computed from the open codebase. CSRD, banking, clinical trials, pharmacovigilance, NERC CIP, insurance claims, FedRAMP, tax audit.",
  alternates: { canonical: "/readiness" },
};

const ICONS: Record<VerticalSlug, string> = {
  csrd: "🌱",
  banking: "🏦",
  "clinical-trials": "🧪",
  pharmacovigilance: "💊",
  "insurance-claims": "📋",
  utilities: "⚡",
  defense: "🛡️",
  "tax-audit": "📊",
};

const AXES: Record<string, string> = {
  landing: "Landing page",
  pack: "Regulatory pack SKU",
  primitives: "Crypto primitives",
  frameworks: "Framework mappings",
  anchor: "Anchor chain",
  retention: "Retention policy",
  acv: "ACV range",
  buyer: "Buyer persona",
  workflows: "Workflows documented",
  auditBundle: "Audit-bundle template",
  replaySeat: "Auditor Replay Seat",
};

export default function ReadinessPage() {
  const scores = scoreAllVerticals().sort((a, b) => b.score - a.score);
  const platform = platformReadiness();

  return (
    <div className="min-h-screen bg-[#010101] text-neutral-200">
      <nav className="border-b border-white/5 px-6 py-4 bg-[#010101]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-sm font-bold text-white tracking-wide">
            Sovereign Matrix
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/investors"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Investors
            </Link>
            <Link
              href="/vs/compare"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              vs compare
            </Link>
            <Link
              href="/demo/verify-receipt"
              className="text-xs px-4 py-2 rounded-full bg-cyan-500 text-black font-semibold hover:bg-cyan-400 transition-colors"
            >
              Verify demo
            </Link>
          </div>
        </div>
      </nav>

      <header className="max-w-6xl mx-auto px-6 pt-20 pb-12">
        <p className="text-[10px] uppercase tracking-[0.4em] text-cyan-400 mb-4">
          Platform Readiness
        </p>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white max-w-3xl">
          <span className="tabular-nums">{platform.avg}</span>
          <span className="text-cyan-400">/100</span>
          <span className="block mt-2 text-2xl md:text-3xl text-neutral-300 font-serif italic">
            across {scores.length} verticals.
          </span>
        </h1>
        <p className="mt-6 text-neutral-400 text-base leading-relaxed max-w-2xl">
          Every vertical scored programmatically from{" "}
          <code className="text-cyan-300 text-sm">
            src/lib/vertical-readiness.ts
          </code>
          . Eleven axes per vertical: landing page · regulatory pack · crypto
          primitives · framework mappings · anchor chain · retention policy ·
          ACV · buyer · workflows · audit-bundle template · Auditor Replay Seat.{" "}
          <span className="text-neutral-300">
            Verifiable in the open codebase.
          </span>
        </p>

        <div className="mt-8 grid sm:grid-cols-3 gap-3">
          <Headline label="Platform avg" value={`${platform.avg}/100`} />
          <Headline label="Top vertical" value={`${platform.max}/100`} />
          <Headline label="Lowest vertical" value={`${platform.min}/100`} />
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-8">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
          Vertical scoreboard
        </h2>
        <div className="space-y-3">
          {scores.map((s) => {
            const v = VERTICALS[s.slug];
            return (
              <Link
                key={s.slug}
                href={v.landingPath}
                className="block p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-cyan-500/40 transition-colors"
              >
                <div className="flex items-baseline justify-between gap-4 flex-wrap mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{ICONS[s.slug]}</span>
                    <div>
                      <h3 className="text-base font-semibold text-white">
                        {s.name}
                      </h3>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        {v.buyer} · ACV ${v.acvUsd.low.toLocaleString()}–$
                        {v.acvUsd.high.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <ScorePill score={s.score} />
                </div>

                <div className="flex flex-wrap gap-1.5 mt-3">
                  {Object.entries(s.breakdown).map(([axis, pts]) => {
                    const max = MAX_BY_AXIS[axis] ?? 10;
                    const ok = pts === max;
                    const partial = pts > 0 && pts < max;
                    return (
                      <span
                        key={axis}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] uppercase tracking-wider font-medium border ${
                          ok
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                            : partial
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-300"
                              : "bg-rose-500/10 border-rose-500/20 text-rose-300"
                        }`}
                        title={`${pts}/${max} pts`}
                      >
                        {ok ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : partial ? (
                          <Minus className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        {AXES[axis] ?? axis}
                      </span>
                    );
                  })}
                </div>

                {s.missing.length > 0 ? (
                  <p className="mt-3 text-[11px] text-amber-300/80 italic">
                    Gap: {s.missing.join(" · ")}
                  </p>
                ) : (
                  <p className="mt-3 text-[11px] text-emerald-300/80">
                    100/100 — every axis green.
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="p-10 rounded-3xl border border-cyan-500/15 bg-cyan-500/[0.03]">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-3">
            Procurement teams: this score is the SLA.
          </h2>
          <p className="text-sm text-neutral-300 max-w-2xl mb-6">
            Click any vertical above to see the landing page + the named
            primitives + the framework mappings. Every score is computed from
            the open codebase, not the marketing team — auditors trust the
            number because it&rsquo;s verifiable.
          </p>
          <Link
            href="/investors"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors"
          >
            See the investor data room
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/5 px-6 py-10">
        <div className="max-w-6xl mx-auto text-[11px] text-neutral-500 flex flex-wrap gap-6">
          <Link href="/spec" className="hover:text-neutral-300">
            VAOS 2.0 receipts spec
          </Link>
          <Link href="/investors" className="hover:text-neutral-300">
            Investors
          </Link>
          <Link href="/demo/verify-receipt" className="hover:text-neutral-300">
            Verify demo
          </Link>
        </div>
      </footer>
    </div>
  );
}

const MAX_BY_AXIS: Record<string, number> = {
  landing: 10,
  pack: 15,
  primitives: 15,
  frameworks: 10,
  anchor: 5,
  retention: 5,
  acv: 5,
  buyer: 5,
  workflows: 10,
  auditBundle: 10,
  replaySeat: 10,
};

function Headline({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
      <p className="text-3xl font-black text-white tabular-nums">{value}</p>
      <p className="text-[11px] uppercase tracking-wider text-neutral-500 mt-1">
        {label}
      </p>
    </div>
  );
}

function ScorePill({ score }: { score: number }) {
  const color =
    score === 100
      ? "border-emerald-500/40 bg-emerald-500/[0.05] text-emerald-300"
      : score >= 85
        ? "border-cyan-500/40 bg-cyan-500/[0.05] text-cyan-300"
        : score >= 60
          ? "border-amber-500/40 bg-amber-500/[0.05] text-amber-300"
          : "border-rose-500/40 bg-rose-500/[0.05] text-rose-300";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-bold tabular-nums ${color}`}
    >
      {score}
      <span className="text-xs font-normal opacity-70">/100</span>
    </span>
  );
}
