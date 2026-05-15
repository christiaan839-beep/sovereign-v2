import Link from "next/link";
import { ArrowRight, Clock, ShieldCheck, FileText, Code2 } from "lucide-react";
import type { Metadata } from "next";
import { STARTER_PACKS, ctaFor, type StarterFamily } from "@/lib/starter-packs";

/**
 * /starter-packs — Self-serve revenue surface (Cook 149).
 *
 * Small SKUs (audit / kit / advisory hour / API trial) the visitor
 * buys today via Stripe Payment Links — no sales call, no
 * onboarding deck. The page is the entire funnel.
 *
 * Each card resolves its CTA via ctaFor() so when the Stripe link
 * env is unset, the visitor still has a path (the contact form).
 */

export const metadata: Metadata = {
  title:
    "Starter Packs · Buy Cryptographic Verification Today · Sovereign Matrix",
  description:
    "Audits, advisory hours, API trials, and implementation kits — small SKUs you can buy today without a sales call. $99-$999.",
  alternates: { canonical: "/starter-packs" },
};

const FAMILY_LABEL: Record<StarterFamily, string> = {
  audit: "Audits",
  kit: "Implementation kits",
  hour: "Advisory hours",
  trial: "API trials",
};

const FAMILY_ICON: Record<StarterFamily, typeof ShieldCheck> = {
  audit: ShieldCheck,
  kit: Code2,
  hour: Clock,
  trial: FileText,
};

function moneyFormat(cents: number): string {
  return `$${(cents / 100).toLocaleString()}`;
}

export default function StarterPacksPage() {
  const all = Object.values(STARTER_PACKS);
  const families: StarterFamily[] = ["audit", "kit", "hour", "trial"];

  return (
    <div className="min-h-screen bg-[#010101] text-neutral-200">
      <nav className="border-b border-white/5 px-6 py-4 bg-[#010101]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-sm font-bold text-white tracking-wide">
            Sovereign Matrix
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/grants"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Grants
            </Link>
            <Link
              href="/investors"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Investors
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
          Self-Serve · No Sales Call
        </p>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white max-w-3xl">
          Buy cryptographic AI verification{" "}
          <span className="text-cyan-400">today.</span>
        </h1>
        <p className="mt-6 text-neutral-400 text-base leading-relaxed max-w-2xl">
          $99 founder hour. $499 endpoint audit. $999 regulatory pack template.
          Self-serve via Stripe Payment Links — no 6-month procurement cycle, no
          demo deck. The repo IS the proof; this is the on-ramp.
        </p>
      </header>

      {families.map((family) => {
        const Icon = FAMILY_ICON[family];
        const rows = all.filter((p) => p.family === family);
        if (rows.length === 0) return null;
        return (
          <section key={family} className="max-w-6xl mx-auto px-6 py-8">
            <div className="flex items-center gap-2.5 mb-6">
              <Icon className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500">
                {FAMILY_LABEL[family]}
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {rows.map((p) => {
                const cta = ctaFor(p.id);
                const external = cta.url.startsWith("http");
                return (
                  <div
                    key={p.id}
                    className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] flex flex-col"
                  >
                    <div className="flex items-baseline justify-between gap-4 mb-3">
                      <h3 className="text-sm font-semibold text-white">
                        {p.name}
                      </h3>
                      <span className="text-cyan-400 font-bold tabular-nums shrink-0">
                        {moneyFormat(p.priceUsdCents)}
                      </span>
                    </div>
                    <p className="text-[11px] uppercase tracking-wider text-neutral-500 mb-3">
                      {p.unitLabel}
                    </p>
                    <p className="text-xs text-neutral-300 leading-relaxed mb-3">
                      {p.blurb}
                    </p>
                    <p className="text-[11px] text-neutral-500 italic mb-5">
                      {p.audience}
                    </p>
                    <div className="mt-auto pt-4 border-t border-white/[0.04]">
                      <a
                        href={cta.url}
                        target={external ? "_blank" : undefined}
                        rel={external ? "noopener noreferrer" : undefined}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-cyan-500 text-black font-semibold text-xs hover:bg-cyan-400 transition-colors"
                      >
                        {cta.payable ? "Buy now" : "Request quote"}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                      <p className="text-[10px] text-neutral-600 mt-2">
                        {p.pitch}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="p-10 rounded-3xl border border-cyan-500/15 bg-cyan-500/[0.03]">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-3">
            Bigger budget?
          </h2>
          <p className="text-sm text-neutral-300 max-w-2xl mb-6">
            The enterprise track is $45K–$75K/yr Regulatory Packs plus $50K/yr
            Auditor Replay Seats. Book a 30-minute call to scope.
          </p>
          <Link
            href="mailto:founder@sovereignmatrix.agency?subject=Enterprise%20Sovereign%20Conversation"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors"
          >
            Talk to the founder
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/5 px-6 py-10">
        <div className="max-w-6xl mx-auto text-[11px] text-neutral-500 flex flex-wrap gap-6">
          <Link href="/grants" className="hover:text-neutral-300">
            Grants
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
