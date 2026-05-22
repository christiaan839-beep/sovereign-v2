import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  Layers,
  Zap,
  Target,
  TrendingUp,
} from "lucide-react";
import type { Metadata } from "next";
import { LiveInvestorProof } from "@/components/investors/LiveInvestorProof";

/**
 * /investors — Data-room front door (Cook 144).
 *
 * The single URL the founder DMs to VCs / angels / strategics. Sharp,
 * numbers-forward, defensible. No fluff. The page is the pitch.
 *
 * Update the numbers in the constants below whenever the underlying
 * truth changes — keep this page honest above everything else.
 */

export const metadata: Metadata = {
  title: "Investors · Sovereign Matrix",
  description:
    "Cryptographically-verifiable AI agents. Vanta sold for $2.45B doing compliance scoreboards — we ship the cryptographic layer underneath every AI decision.",
  alternates: { canonical: "/investors" },
  robots: { index: false, follow: false },
};

// ── Numbers shown on the page — update when the codebase changes ──────────

const REPO_FACTS = {
  agents: 145,
  tests: 2438,
  cooks: 143,
  cryptoMoats: 7,
  verticalLandings: 22,
  addOnSkus: 7,
  dbTables: 38,
  llmProviders: 8,
};

const COMPARABLES = [
  {
    name: "Vanta",
    sold: "$2.45B",
    arr: "$200M",
    multiple: "12.3x",
    note: "Compliance scoreboard for SOC 2 — no crypto moat. Sold 2024.",
  },
  {
    name: "Drata",
    sold: "$2.0B (priv)",
    arr: "$50M+",
    multiple: "40x",
    note: "Same SOC 2 scoreboard category. Series C, 2022.",
  },
  {
    name: "Workiva",
    sold: "$4.7B (mkt cap)",
    arr: "$700M",
    multiple: "6.7x",
    note: "SEC + CSRD disclosure platform. Direct CSRD-play comp.",
  },
  {
    name: "HashiCorp",
    sold: "IPO $14B",
    arr: "$350M",
    multiple: "40x",
    note: "Infra-trust (Vault). The crypto-moat premium is real.",
  },
  {
    name: "Snyk",
    sold: "$7.4B (priv)",
    arr: "$200M+",
    multiple: "35x+",
    note: "Developer security. Compound moat, similar TAM.",
  },
];

const MOATS = [
  {
    icon: ShieldCheck,
    title: "Cryptographic receipts (the wedge)",
    desc: "HMAC-SHA256 + Ed25519 + Merkle inclusion proofs on every agent run. Vanta, Drata, OneTrust — none ship this. Auditors verify the AI decision in their own workpaper system instead of trusting our screenshot.",
  },
  {
    icon: Layers,
    title: "Cross-tenant ZK pass-rate proofs",
    desc: "Industry consortiums (FS-ISAC, BITS, HITRUST) can prove member AIs pass safety bar X% without sharing raw data. Anon credentials let auditors verify holder identity without exposing the tenant.",
  },
  {
    icon: Zap,
    title: "Receipt-chain ratchet + watermarking",
    desc: "Tamper-evident chronological log + content provenance. Storm-response reports, clinical-trial monitoring visits, claims-adjudication decisions — all cryptographically prevented from retroactive rewrite.",
  },
  {
    icon: Target,
    title: "Verifiable model fingerprinting",
    desc: "Commits provider/modelId/version + behavior canary hash to every receipt. Detects silent provider-side model swaps — the failure mode the industry has not yet priced in.",
  },
];

const ASKS = [
  {
    stage: "Pre-seed extension",
    amount: "$500K – $1.5M",
    use: "9-month runway · 1 GTM hire · 2 design-partner pilots closed",
    target:
      "Solo-founder-friendly: Y Combinator, Techstars, Pioneer, Indie.vc, individual angels (Vanta / Drata / Anthropic exec network)",
  },
  {
    stage: "Seed / Seed+",
    amount: "$3M – $8M",
    use: "18-month runway · 5-person team · 4 paid logos · 1 Big-4 alliance",
    target:
      "Ten Eleven, Forgepoint, F-Prime (RegTech), Index, Greylock (Chandna), Bessemer (Cowan)",
  },
  {
    stage: "Series A",
    amount: "$15M – $25M",
    use: "$5M ARR run-rate · regulator-as-customer wedge live · 15+ logos",
    target:
      "Sequoia (Grady), a16z (Casado / Shen), Coatue, Insight (Vanta + Drata lineage)",
  },
];

const VERTICALS = [
  ["EU CSRD / ESRS auditor add-on", "$250-400K ACV", "/for-csrd"],
  ["Pharma clinical trials (Part 11)", "$300-600K ACV", "/for-clinical-trials"],
  ["Pharmacovigilance (ICH E2B)", "$250-500K ACV", "/for-pharmacovigilance"],
  ["SR 11-7 model risk (banking)", "$150-350K ACV", "/for-banking"],
  ["NERC CIP utilities", "$400-800K ACV", "/for-utilities"],
  ["NAIC AI bias (claims)", "$200-500K ACV", "/for-insurance-claims"],
  ["FedRAMP defense procurement", "$500K-$2M ACV", "/for-defense"],
  ["Tax audit defense", "$300-600K ACV", "/for-tax-audit"],
];

export default function InvestorsPage() {
  return (
    <div className="min-h-screen bg-[#010101] text-neutral-200">
      <nav className="border-b border-white/5 px-6 py-4 bg-[#010101]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-sm font-bold text-white tracking-wide">
            Sovereign Matrix
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/spec"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Receipts spec
            </Link>
            <Link
              href="/trust"
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Trust posture
            </Link>
            <Link
              href="mailto:founder@sovereignmatrix.agency?subject=Sovereign%20Matrix%20Intro%20Call"
              className="text-xs px-4 py-2 rounded-full bg-cyan-500 text-black font-semibold hover:bg-cyan-400 transition-colors"
            >
              Book a call
            </Link>
          </div>
        </div>
      </nav>

      <header className="max-w-6xl mx-auto px-6 pt-20 pb-12">
        <p className="text-[10px] uppercase tracking-[0.4em] text-cyan-400 mb-4">
          Investor Data Room
        </p>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white max-w-4xl">
          The cryptographic layer{" "}
          <span className="text-cyan-400">underneath every AI decision.</span>
        </h1>
        <p className="mt-6 text-neutral-400 text-base leading-relaxed max-w-2xl">
          Vanta sold for $2.45B at $200M ARR doing compliance scoreboards. They
          don&rsquo;t have the cryptographic moat. We do. Same buyer (CISO, CCO,
          Chief Audit Executive) — 10× bigger budget unlock once AI decisions
          move into regulated workflows.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="mailto:founder@sovereignmatrix.agency?subject=Sovereign%20Matrix%20Intro%20Call"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors"
          >
            Book a 30-minute intro
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/verify"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-white/10 text-neutral-300 hover:text-white hover:border-white/20 transition-colors text-sm"
          >
            Verify a real receipt in 60s
          </Link>
        </div>
      </header>

      {/* Wave 119 — live diligence-grade proof tiles above the static
          inventory. Each number is verifiable via the linked endpoint
          and re-checkable by computing locally from open sources. */}
      <section className="max-w-6xl mx-auto px-6 pt-12">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
          Live diligence proof
        </h2>
        <LiveInvestorProof />
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
          Engineering inventory (verifiable in repo)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries({
            "Agent endpoints": REPO_FACTS.agents,
            "Tests passing": REPO_FACTS.tests,
            "Cooks shipped": REPO_FACTS.cooks,
            "Crypto moats": REPO_FACTS.cryptoMoats,
            "Vertical landings": REPO_FACTS.verticalLandings,
            "Add-on SKUs": REPO_FACTS.addOnSkus,
            "DB tables": REPO_FACTS.dbTables,
            "LLM providers": REPO_FACTS.llmProviders,
          }).map(([label, value]) => (
            <div
              key={label}
              className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02]"
            >
              <p className="text-3xl font-black text-white tabular-nums">
                {value.toLocaleString()}
              </p>
              <p className="text-[11px] uppercase tracking-wider text-neutral-500 mt-1">
                {label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
          What we ship that nobody else does
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {MOATS.map((m) => (
            <div
              key={m.title}
              className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]"
            >
              <div className="flex items-center gap-3 mb-3">
                <m.icon className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">{m.title}</h3>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                {m.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
          Comparable exits — pricing the moat
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
          <table className="w-full text-xs">
            <thead className="bg-white/[0.03]">
              <tr>
                <th className="text-left px-4 py-3 text-neutral-500 font-medium">
                  Company
                </th>
                <th className="text-left px-4 py-3 text-neutral-500 font-medium">
                  Outcome
                </th>
                <th className="text-left px-4 py-3 text-neutral-500 font-medium">
                  ARR
                </th>
                <th className="text-left px-4 py-3 text-neutral-500 font-medium">
                  Multiple
                </th>
                <th className="text-left px-4 py-3 text-neutral-500 font-medium">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARABLES.map((c) => (
                <tr key={c.name} className="border-t border-white/[0.04]">
                  <td className="px-4 py-3 text-white font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-cyan-400 tabular-nums">
                    {c.sold}
                  </td>
                  <td className="px-4 py-3 text-neutral-300 tabular-nums">
                    {c.arr}
                  </td>
                  <td className="px-4 py-3 text-neutral-300 tabular-nums">
                    {c.multiple}
                  </td>
                  <td className="px-4 py-3 text-neutral-400">{c.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-neutral-500 max-w-3xl">
          Defensible multiple range at Series A/B:{" "}
          <span className="text-neutral-300">15-25x ARR</span> — the crypto moat
          alone justifies a 5-10x premium on the Vanta/Drata baseline.
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
          Eight verticals × an Auditor Replay Seat add-on
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {VERTICALS.map(([title, acv, href]) => (
            <Link
              key={title}
              href={href}
              className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:border-white/15 transition-colors flex items-center justify-between gap-4"
            >
              <div>
                <p className="text-sm text-white font-medium">{title}</p>
                <p className="text-xs text-cyan-400 mt-1">{acv}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-neutral-500 shrink-0" />
            </Link>
          ))}
        </div>
        <p className="mt-4 text-xs text-neutral-500">
          Every vertical also drives an Auditor Replay Seat — $50K/seat/year
          read-only access for external auditors. Powered by anonymous
          credentials so the auditor verifies receipts without ever seeing the
          underlying tenant id.
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
          Capital plan
        </h2>
        <div className="space-y-3">
          {ASKS.map((a) => (
            <div
              key={a.stage}
              className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02]"
            >
              <div className="flex items-baseline justify-between gap-4 flex-wrap">
                <h3 className="text-sm font-semibold text-white">{a.stage}</h3>
                <p className="text-cyan-400 tabular-nums">{a.amount}</p>
              </div>
              <p className="text-xs text-neutral-400 mt-2">{a.use}</p>
              <p className="text-[11px] text-neutral-500 mt-2">
                <span className="text-neutral-400">Targeting:</span> {a.target}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-sm uppercase tracking-[0.3em] text-neutral-500 mb-6">
          Trajectory
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-6 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <p className="text-sm font-semibold text-white">Base case</p>
            </div>
            <p className="text-3xl font-black text-white tabular-nums">
              $700M – $1.5B
            </p>
            <p className="text-[11px] text-neutral-500 mt-1">
              Strategic exit or IPO · Year 3-4
            </p>
            <p className="text-xs text-neutral-400 mt-3 leading-relaxed">
              CSRD wedge + 2 verticals lit, $50-80M ARR at 10-15x multiple.
              Mirror of the Vanta trajectory with the crypto premium.
            </p>
          </div>
          <div className="p-6 rounded-2xl border border-cyan-500/15 bg-cyan-500/[0.03]">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <p className="text-sm font-semibold text-white">Ceiling case</p>
            </div>
            <p className="text-3xl font-black text-cyan-300 tabular-nums">
              $5B – $8B
            </p>
            <p className="text-[11px] text-neutral-500 mt-1">
              Public · Year 4-6
            </p>
            <p className="text-xs text-neutral-400 mt-3 leading-relaxed">
              Becomes the verification standard for the AI economy.
              Regulator-as-customer motion live (OCC, FDA, ESMA, NERC). Mirror
              of HashiCorp / Snyk multiples.
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="p-10 rounded-3xl border border-cyan-500/15 bg-cyan-500/[0.03]">
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-3">
            One slide, one call, one signed term sheet.
          </h2>
          <p className="text-sm text-neutral-300 max-w-2xl mb-6">
            The data room above is the slide. Book a 30-minute call to see a
            live audit-bundle replay, walk through the four named accounts I am
            actively closing, and decide whether the Vanta-comparable check fits
            your stage thesis.
          </p>
          <Link
            href="mailto:founder@sovereignmatrix.agency?subject=Sovereign%20Matrix%20Intro%20Call"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cyan-500 text-black font-semibold text-sm hover:bg-cyan-400 transition-colors"
          >
            founder@sovereignmatrix.agency
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/5 px-6 py-10">
        <div className="max-w-6xl mx-auto text-[11px] text-neutral-500 flex flex-wrap gap-6">
          <Link href="/spec" className="hover:text-neutral-300">
            VAOS 2.0 receipts spec
          </Link>
          <Link href="/trust" className="hover:text-neutral-300">
            Trust posture
          </Link>
          <Link href="/agents" className="hover:text-neutral-300">
            140 agents
          </Link>
          <Link href="/demo/verify-receipt" className="hover:text-neutral-300">
            Live verify demo
          </Link>
        </div>
      </footer>
    </div>
  );
}
