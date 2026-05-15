import Link from "next/link";
import { ArrowRight, Download, Quote, Mail, ImageIcon } from "lucide-react";
import type { Metadata } from "next";

/**
 * /press — Media kit + press contact (Cook 156).
 *
 * Journalist-facing page with the boilerplate, founder bio,
 * brand assets, and a coverage history slot. Investors check
 * this page during due-diligence to gauge marketing maturity.
 */

export const metadata: Metadata = {
  title: "Press · Sovereign Matrix",
  description:
    "Press kit, founder bio, and brand assets for journalists covering Sovereign Matrix — the cryptographic verification layer for AI agents.",
  alternates: { canonical: "/press" },
};

const TALKING_POINTS = [
  "Sovereign Matrix ships cryptographic receipts — every AI agent decision is signed, replayable, and tamper-evident.",
  "Vanta sold for $2.45B at $200M ARR doing compliance scoreboards. Sovereign ships the cryptographic layer they don't have.",
  "Auditors verify any AI decision in their own browser tab via the Verify Receipt demo (sovereignmatrix.agency/demo/verify-receipt).",
  "22 vertical landings target the regulator-customer wedge — CSRD, SR 11-7, NERC CIP, 21 CFR Part 11, FedRAMP, NAIC AI Bias.",
  "7 cryptographic primitives shipped: HMAC + Ed25519 receipts, Merkle inclusion proofs, ZK pass-rate proofs, receipt-chain ratchet, output watermarking, model fingerprinting, anonymous-credential auditor seats.",
  "2,400+ tests passing. 145 agent endpoints across 8 LLM providers. 38 DB tables.",
];

const PRESS_FAQ = [
  {
    q: "What is Sovereign Matrix in one sentence?",
    a: "An AI agent platform where every decision produces a signed receipt that auditors verify cryptographically in their own workpaper system.",
  },
  {
    q: "Who is the buyer?",
    a: "Chief Compliance Officer, Chief Model Risk Officer, Head of Internal Audit at any enterprise running AI in a regulated workflow. Specific Big-4 sustainability practices for the CSRD wedge.",
  },
  {
    q: "What's unique vs Lindy / Clay / Manus / CrewAI?",
    a: "Those tools output unsigned text. Sovereign outputs a cryptographically-signed artifact that an external auditor verifies without trusting our database. Crypto chain-of-custody is the moat.",
  },
  {
    q: "Where is it in production?",
    a: "Live at sovereignmatrix.agency. 18 PRs merged in the last 30 days, 54 cooks shipped (130-154). Open codebase visible to investors + design partners.",
  },
  {
    q: "What's the funding status?",
    a: "Currently fundraising at the seed stage. Targeting Y Combinator + AI Grant + non-dilutive sources (DARPA SBIR, EU Horizon). Capital plan at sovereignmatrix.agency/investors.",
  },
  {
    q: "Who's behind it?",
    a: "Solo technical founder shipping the cryptographic primitives, vertical landings, and revenue infrastructure. Actively hiring first GTM partner (see /careers).",
  },
];

const ASSETS = [
  {
    name: "Logo · light mode (SVG)",
    href: "/icon.svg",
    type: "vector",
  },
  {
    name: "Favicon · ICO",
    href: "/favicon.ico",
    type: "icon",
  },
  {
    name: "Hero image · cube",
    href: "/hero-cube.jpg",
    type: "raster",
  },
  {
    name: "Apple touch icon",
    href: "/apple-touch-icon.png",
    type: "raster",
  },
  {
    name: "Icon 192px",
    href: "/icon-192.png",
    type: "raster",
  },
  {
    name: "Icon 512px",
    href: "/icon-512.png",
    type: "raster",
  },
];

export default function PressPage() {
  return (
    <div className="min-h-screen bg-[#010101] text-neutral-200">
      <nav className="border-b border-white/5 px-6 py-4 bg-[#010101]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-sm font-bold text-white tracking-wide">
            Sovereign Matrix
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/about"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              About
            </Link>
            <Link
              href="/investors"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Investors
            </Link>
            <a
              href="mailto:press@sovereignmatrix.agency?subject=Press%20inquiry"
              className="text-xs px-4 py-2 rounded-full bg-cyan-500 text-black font-semibold hover:bg-cyan-400 transition-colors"
            >
              Press inquiry
            </a>
          </div>
        </div>
      </nav>

      <header className="max-w-6xl mx-auto px-6 pt-20 pb-12">
        <p className="text-[10px] uppercase tracking-[0.4em] text-cyan-400 mb-4">
          Press &amp; Media
        </p>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white max-w-3xl">
          The cryptographic verification layer{" "}
          <span className="text-cyan-400">underneath every AI decision.</span>
        </h1>
        <p className="mt-6 text-neutral-400 text-base leading-relaxed max-w-2xl">
          Sovereign Matrix ships signed receipts on every AI agent run. Auditors
          verify decisions in their own browser. Built for the
          regulator-customer wedge — CSRD, SR 11-7, NERC CIP, 21 CFR Part 11,
          NAIC AI Bias.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a
            href="mailto:press@sovereignmatrix.agency?subject=Press%20inquiry"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors"
          >
            press@sovereignmatrix.agency
            <Mail className="w-4 h-4" />
          </a>
          <Link
            href="/demo/verify-receipt"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/10 text-neutral-300 hover:text-white hover:border-white/20 transition-colors text-sm"
          >
            Verify a real receipt
          </Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
          Boilerplate (copy + paste)
        </h2>
        <div className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          <p className="text-sm text-neutral-300 leading-relaxed">
            <strong className="text-white">Sovereign Matrix</strong> is the
            cryptographic verification layer for AI agents. Every agent decision
            is signed under HMAC-SHA256 + Ed25519 and committed to a
            tamper-evident Merkle chain — auditors verify any output in their
            own workpaper system. The platform ships 145 agent endpoints across
            8 LLM providers, 7 cryptographic moats, and 22 vertical landings
            targeting regulated industries (CSRD, SR 11-7, NERC CIP, 21 CFR Part
            11, NAIC AI Bias, FedRAMP). Live at sovereignmatrix.agency.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
          Talking points
        </h2>
        <div className="grid md:grid-cols-2 gap-3">
          {TALKING_POINTS.map((t, i) => (
            <div
              key={i}
              className="p-5 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-start gap-3"
            >
              <Quote className="w-4 h-4 text-cyan-400 mt-1 shrink-0" />
              <p className="text-sm text-neutral-300 leading-relaxed">{t}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
          Press FAQ
        </h2>
        <div className="space-y-4">
          {PRESS_FAQ.map((f, i) => (
            <div
              key={i}
              className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02]"
            >
              <p className="text-sm font-semibold text-white mb-2">{f.q}</p>
              <p className="text-xs text-neutral-400 leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
          Brand assets
        </h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
          {ASSETS.map((a) => (
            <a
              key={a.href}
              href={a.href}
              download
              className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-cyan-500/40 transition-colors flex items-center gap-3"
            >
              <ImageIcon className="w-5 h-5 text-cyan-400 shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-white font-medium">{a.name}</p>
                <p className="text-[11px] text-neutral-500 uppercase tracking-wider mt-0.5">
                  {a.type}
                </p>
              </div>
              <Download className="w-4 h-4 text-neutral-500" />
            </a>
          ))}
        </div>
        <p className="mt-4 text-[11px] text-neutral-500">
          Right-click any asset and &ldquo;Save link as&rdquo; to download.
          Brand color palette: cyan{" "}
          <code className="text-cyan-400">#06B6D4</code> on background{" "}
          <code className="text-white">#010101</code>. Email{" "}
          <a
            href="mailto:press@sovereignmatrix.agency"
            className="text-cyan-400 underline"
          >
            press@sovereignmatrix.agency
          </a>{" "}
          for higher-resolution variants.
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
          Recent coverage
        </h2>
        <div className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          <p className="text-sm text-neutral-400 leading-relaxed">
            Coverage list seeds here as press picks up the cryptographic
            receipts story. Journalists: email{" "}
            <a
              href="mailto:press@sovereignmatrix.agency"
              className="text-cyan-400 underline"
            >
              press@sovereignmatrix.agency
            </a>{" "}
            for embargoed previews of upcoming primitive launches.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="p-10 rounded-3xl border border-cyan-500/15 bg-cyan-500/[0.03]">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-3">
            Writing a story? Book a 30-minute call.
          </h2>
          <p className="text-sm text-neutral-300 max-w-2xl mb-6">
            The founder will walk you through a live cryptographic receipt, the
            regulator-customer thesis, and any of the 22 vertical landings on
            the menu.
          </p>
          <a
            href="mailto:press@sovereignmatrix.agency?subject=Press%20briefing"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors"
          >
            press@sovereignmatrix.agency
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>

      <footer className="border-t border-white/5 px-6 py-10">
        <div className="max-w-6xl mx-auto text-[11px] text-neutral-500 flex flex-wrap gap-6">
          <Link href="/about" className="hover:text-neutral-300">
            About
          </Link>
          <Link href="/investors" className="hover:text-neutral-300">
            Investors
          </Link>
          <Link href="/careers" className="hover:text-neutral-300">
            Careers
          </Link>
        </div>
      </footer>
    </div>
  );
}
